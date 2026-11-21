import React from 'react';
import { ArrowUpLeft, Copy, Check, ThumbsUp, ThumbsDown } from 'lucide-react';
import { renderEngineeringMarkdown } from '../../utils/engineeringMarkdown';
import { CognivoGeometricLogo } from '../common/AiFloatingButton';

export interface WorkspaceMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  time: string;
  suggestedAction?: {
    label: string;
    link?: string;
  };
}

interface WorkspaceMessageItemProps {
  message: WorkspaceMessage;
  isCopied: boolean;
  feedback?: 'up' | 'down';
  onCopy: (text: string, id: string) => void;
  onFeedback: (id: string, vote: 'up' | 'down') => void;
  onNavigateLink: (link: string) => void;
}

export const WorkspaceMessageItem: React.FC<WorkspaceMessageItemProps> = React.memo(
  ({ message, isCopied, feedback, onCopy, onFeedback, onNavigateLink }) => {
    const isUser = message.sender === 'user';

    if (isUser) {
      return (
        <div className="flex justify-end py-1">
          <div className="max-w-[88%] sm:max-w-[74%] rounded-[20px] rounded-tr-md bg-[#F3F4F6] border border-[#E5E7EB]/80 text-[#2B313A] px-4 py-2.5 sm:px-5 sm:py-3">
            <div className="text-[13.5px] sm:text-[14.5px] leading-[1.75] whitespace-pre-wrap break-words font-normal">
              {message.text}
            </div>
          </div>
        </div>
      );
    }

    return (
      <article className="group flex items-start gap-2.5 sm:gap-4 py-2">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#FFFFFF] border border-[#DFE3E6] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
          <CognivoGeometricLogo className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
        </div>

        <div className="min-w-0 flex-1 space-y-2.5">
          {/* Editorial Prose Stream */}
          <div className="text-[13.5px] sm:text-[14.5px] leading-[1.82] text-[#2B313A] break-words">
            {renderEngineeringMarkdown(message.text, false)}
          </div>

          {/* Suggested Catalog Navigation CTA */}
          {message.suggestedAction && message.suggestedAction.link && (
            <div className="pt-1 max-w-md">
              <button
                type="button"
                onClick={() => onNavigateLink(message.suggestedAction!.link!)}
                className="w-full min-h-[42px] py-2 px-4 rounded-xl bg-[#F5F6F6] hover:bg-[#E06518] text-[#2B313A] hover:text-white font-bold text-xs flex items-center justify-between border border-[#DFE3E6] hover:border-[#E06518] transition-colors duration-150 cursor-pointer group/cta"
              >
                <span className="truncate">{message.suggestedAction.label}</span>
                <ArrowUpLeft className="w-4 h-4 shrink-0 text-[#74757C] group-hover/cta:text-white transition-colors" />
              </button>
            </div>
          )}

          {/* Quiet Website-Toned Action Strip */}
          {message.text.trim().length > 0 && (
            <div className="flex items-center justify-between pt-0.5 text-xs">
              <div className="flex items-center gap-0.5 text-[#74757C]">
                <button
                  type="button"
                  onClick={() => onCopy(message.text, message.id)}
                  className="min-w-[36px] min-h-[36px] px-2 hover:text-[#2B313A] hover:bg-[#F3F4F6] rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  title="کپی پاسخ"
                  aria-label="کپی پاسخ"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700 font-semibold text-[11px]">کپی شد</span>
                    </>
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onFeedback(message.id, 'up')}
                  aria-label="پاسخ مفید بود"
                  className={`min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                    feedback === 'up'
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'hover:text-[#2B313A] hover:bg-[#F3F4F6]'
                  }`}
                  title="مفید بود"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onFeedback(message.id, 'down')}
                  aria-label="پاسخ نیاز به بازنگری دارد"
                  className={`min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                    feedback === 'down'
                      ? 'text-rose-700 bg-rose-50'
                      : 'hover:text-[#2B313A] hover:bg-[#F3F4F6]'
                  }`}
                  title="نیاز به بازنگری"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
              </div>

              <span className="text-[11px] text-[#777A7D] tabular-nums font-mono opacity-85">
                {message.time}
              </span>
            </div>
          )}
        </div>
      </article>
    );
  },
);

WorkspaceMessageItem.displayName = 'WorkspaceMessageItem';