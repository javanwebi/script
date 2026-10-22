export const particleVertex = /* glsl */ `
precision highp float;
attribute vec3 aColor;
attribute vec4 aExtra;
attribute vec4 aSeed;
uniform float uTime;
uniform float uScale;
uniform float uActivity;
uniform float uIntroDuration;
varying vec3 vColor;
varying float vAlpha;
float gauss(float x){return exp(-x*x);}
void main(){
  vec3 p=position;
  float kind=aExtra.z;
  float y=400.0-p.y;
  float t=uTime;
  float energy=uActivity;
  float hot=aExtra.w;
  float wave=sin(p.x*.066+t*5.1+y*.045)*.62+sin(p.x*.026-t*3.7+y*.077)*.38;
  float mouth=gauss((y-335.0)/65.0);
  float face=(1.0-step(2.5,kind))*(1.0-step(455.0,y));
  p.y+=wave*mouth*face*(1.4+energy*6.2);
  p.x+=sign(p.x)*mouth*face*energy*(3.0+sin(y*.12-t*7.0)*6.5);
  p.x*=1.0+sin(t*1.08)*.0035;
  p.y+=sin(t*1.08)*1.0;
  if(kind>1.5&&kind<2.5){
    float life=fract(t*(.055+aSeed.z*.05)+aSeed.x);
    p.x+=sin(t*.45+aSeed.y*30.0)*(2.0+aSeed.z*4.0);
    p.y+=life*(5.0+aSeed.z*15.0);
  }
  if(kind>2.5&&kind<3.5){p.x+=sin(y*.11-t*2.8+aSeed.x*.25)*(1.2+energy*1.6);}
  float alpha=aExtra.y;
  vec3 color=aColor;
  if(kind<2.5){
    float heat=hot*(.85+energy*.6);
    vec3 amber=mix(vec3(0.878, 0.396, 0.094), vec3(1.0, 0.65, 0.18), clamp(heat*.86,0.0,1.0));
    color=mix(color,amber,clamp(heat*1.5,0.0,1.0));
    color*=1.0+hot*energy*.24;
    alpha*=.8+.2*sin(aSeed.z*30.0+t*1.5);
  }
  if(kind>2.5&&kind<3.5){
    float flow=pow(.5+.5*sin(y*.038+t*3.8),6.0);
    color*=.75+energy*.5+flow*.9;
  }
  if(kind>3.5&&kind<4.5){
    float ring=aExtra.w*8.0;
    float phase=fract(t*.18-ring*.12);
    float pulse=sin(phase*3.14159265);
    p.xy=vec2(p.x,p.y-98.0)*(1.0+phase*.15)+vec2(0.0,98.0);
    alpha*=pulse*(.14+energy*.85);
    alpha*=smoothstep(-175.0,-60.0,p.y);
  }
  if(kind>5.5&&kind<6.5){alpha*=.55+.45*pow(.5+.5*sin(t*4.0+aExtra.w*15.0),2.0);}
  if(kind>6.5&&kind<7.5){
    // Base Ring under AI: gentle orbital shimmer and speech resonance
    float ringPhase = fract(aExtra.w + t * 0.08);
    float wave = sin(ringPhase * 6.2831853 * 2.0);
    p.x *= 1.0 + sin(t * 1.2 + aExtra.w * 6.28) * 0.005;
    p.y += sin(t * 1.4 + aExtra.w * 3.14) * 0.4;
    alpha *= (0.75 + 0.25 * wave) * (0.85 + energy * 0.4);
    color *= (0.9 + 0.2 * wave + energy * 0.3);
  }
  if(kind<3.5){alpha*=1.0-smoothstep(666.0,728.0,y);}
  vColor=color;vAlpha=alpha;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
  gl_PointSize=max(.7,aExtra.x*uScale*(1.0+hot*energy*.12));
}
`;

export const particleFragment = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying float vAlpha;
void main(){
  vec2 p = gl_PointCoord - vec2(0.5);
  float d2 = dot(p, p) * 4.0;
  if(d2 > 1.0) discard;
  float a = (1.0 - d2) * (1.0 - sqrt(d2) * 0.4) * vAlpha;
  gl_FragColor = vec4(vColor, a);
}
`;

export const glowVertex = /* glsl */ `
varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
`;

export const glowFragment = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uActivity;
void main(){
  vec2 p=vUv-.5;
  float radial=exp(-dot(p*vec2(3.3,3.4),p*vec2(3.3,3.4)));
  float core=exp(-dot(p*vec2(6.0,6.5),p*vec2(6.0,6.5)));
  float inTime=1.0;
  float alpha=(radial*.17+core*.10)*(.7+uActivity*.85)*inTime;
  vec3 c=mix(vec3(0.878, 0.396, 0.094), vec3(1.0, 0.65, 0.18), core);
  gl_FragColor=vec4(c,alpha);
}
`;
