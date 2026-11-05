/**
 * Plain-text projection exclusively for the live FORZA call.
 * Consumes cumulative SSE text character-by-character; an incomplete token,
 * Markdown link URL or split "*" marker is never exposed to subtitles/TTS.
 * Nothing is persisted. The original technical identifiers remain untouched.
 */
export class ForzaCallPlainText {
  private seen = '';
  private output = '';
  private word = '';
  private label = '';
  private state: 'text'|'label'|'after-label'|'url' = 'text';
  private urlDepth = 0;
  private lineStart = true;
  private pendingNumericStar = false;
  private pendingImageBang = false;
  private linePrefix = '';

  private flushWord(): void {
    if (!this.word) return;
    if (!/^(?:https?:\/\/|www\.)/i.test(this.word))
      this.output += this.word;
    this.word = '';
  }
  private append(value: string): void {
    if (!value) return;
    for (const ch of value) {
      if (/\s/u.test(ch)) {
        this.flushWord();
        if (this.output && !this.output.endsWith(' ')) this.output += ' ';
      } else this.word += ch;
    }
  }
  private accept(c: string, next: string): void {
    // In a split SSE image marker, an isolated trailing '!' must not flash
    // as subtitle content or enter a Nima utterance before '[' arrives.
    if (this.pendingImageBang) {
      this.pendingImageBang = false;
      if (c === '[') {
        this.state = 'label';
        return;
      }
      this.append('!');
    }
    if (c === '!' && !next) {
      this.pendingImageBang = true;
      return;
    }
    // An ASCII '*' between two digits is a dimension operator, not Markdown.
    // Hold it for one character so a split SSE chunk cannot erase 10*20.
    if (this.pendingNumericStar) {
      if (/[0-9۰-۹]/u.test(c) && /[0-9۰-۹]$/u.test(this.word)) this.word += '×';
      this.pendingNumericStar = false;
    }
    if (this.state === 'label') {
      if (c === ']') {
        this.append(this.label);
        this.label = '';
        this.state = 'after-label';
      } else if (c !== '*' && c.charCodeAt(0) !== 96) this.label += c;
      return;
    }
    if (this.state === 'after-label') {
      this.state = 'text';
      if (c === '(') { this.state = 'url'; this.urlDepth = 1; return; }
    }
    if (this.state === 'url') {
      if (c === '(') this.urlDepth++;
      else if (c === ')' && --this.urlDepth <= 0) this.state = 'text';
      return;
    }
    // Buffer possible Markdown line prefixes until the following character
    // proves whether they are formatting or part of a technical number.
    if (this.lineStart) {
      if (this.linePrefix) {
        const prefix=this.linePrefix;
        if ((/^#+$/u.test(prefix) && c === '#') ||
            (/^[0-9۰-۹]{1,2}$/u.test(prefix) && /[0-9۰-۹]/u.test(c))) {
          this.linePrefix += c; return;
        }
        if (/^[0-9۰-۹]{1,2}$/u.test(prefix) && (c==='.' || c===')')) {
          this.linePrefix += c; return;
        }
        if (/\s/u.test(c) &&
            (/^#+$/u.test(prefix) || /^[•-]$/u.test(prefix) ||
             /^[0-9۰-۹]{1,2}[.)]$/u.test(prefix))) {
          this.linePrefix=''; this.lineStart=false; return;
        }
        this.append(prefix);
        this.linePrefix=''; this.lineStart=false;
      } else if (c==='#' || c==='•' || c==='-' || /[0-9۰-۹]/u.test(c)) {
        this.linePrefix=c; return;
      }
    }
    if (c === '[') { this.state = 'label'; return; }
    // Formatting-only marks are never emitted, including across SSE chunks.
    if (c === '*') {
      if (/[0-9۰-۹]$/u.test(this.word)) this.pendingNumericStar = true;
      return;
    }
    if (c.charCodeAt(0) === 96 || c === '~') return;
    if (c === '!' && next === '[') return;
    if ((c === '#' || c === '•') && this.lineStart) return;
    if (c === '|' && (next === '|' || next === ' ')) { this.append(' '); return; }
    if (c === '\r' || c === '\n') { this.append(' '); this.lineStart = true; return; }
    if (!/\s/u.test(c)) this.lineStart = false;
    this.append(c);
    // A complete short sentence must not wait for the next SSE token/done.
    // Do not flush a possible decimal such as "3." prematurely.
    if (/[.!؟؛]$/u.test(this.word) && !/[0-9۰-۹]\.$/u.test(this.word) &&
        !/^(?:https?:\/\/|www\.)/i.test(this.word))
      this.flushWord();
  }
  push(fullText: string): string {
    if (!fullText.startsWith(this.seen)) throw new Error('forza_call_stream_revised');
    const delta = fullText.slice(this.seen.length);
    this.seen = fullText;
    for (let i = 0; i < delta.length; i++) this.accept(delta[i], delta[i+1] || '');
    return this.output.trimEnd();
  }
  complete(fullText: string): string {
    this.push(fullText);
    if (this.state === 'label') this.append(this.label);
    if (this.linePrefix) this.append(this.linePrefix);
    this.linePrefix='';
    this.state = 'text';
    this.label = '';
    if (this.pendingImageBang) this.append('!');
    this.pendingImageBang = false;
    this.flushWord();
    return this.output.replace(/\s+/gu, ' ').trim();
  }
}

const smallNumbers = [
  'صفر','یک','دو','سه','چهار','پنج','شش','هفت','هشت','نه','ده',
  'یازده','دوازده','سیزده','چهارده','پانزده','شانزده','هفده','هجده','نوزده','بیست'
];
function spokenNumber(value: string): string {
  const n = Number(value.replace(/[۰-۹]/g, ch => String(ch.charCodeAt(0)-1776)));
  if (!Number.isInteger(n) || n < 0 || n > 99) return value;
  if (n <= 20) return smallNumbers[n];
  const tens = ['','','بیست','سی','چهل','پنجاه','شصت','هفتاد','هشتاد','نود'];
  return n % 10 ? tens[Math.floor(n/10)] + ' و ' + smallNumbers[n%10] : tens[Math.floor(n/10)];
}
/** Spoken only. Do not alter the display or product/engineering codes. */
export function forzaSpokenPlainText(text: string): string {
  return text.replace(/(?<![0-9۰-۹.٫])([0-9۰-۹]{1,6}(?:[.٫][0-9۰-۹]+)?)\s*[×xX]\s*([0-9۰-۹]{1,6}(?:[.٫][0-9۰-۹]+)?)(?![0-9۰-۹])/gu,
    (_whole, a: string, b: string) => spokenNumber(a) + ' در ' + spokenNumber(b));
}
