import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Send,
  X,
  PhoneCall,
  LayoutDashboard,
  Trash2,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  ArrowLeft,
} from "lucide-react";
import { apiUrl } from "../../config/apiConfig";
import { renderEngineeringMarkdown } from "../../utils/engineeringMarkdown";
import { STORE_ASSETS } from "../../assets/images";

// Geometric Cognivo orange logo icon matching the reference design
export const CognivoGeometricLogo: React.FC<{
  className?: string;
  size?: number;
}> = ({ className = "w-5 h-5", size }) => (
  <svg
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size ? { width: size, height: size } : undefined}
  >
    <rect x="5" y="11" width="17" height="5" rx="1.5" fill="#E06518" />
    <rect x="11" y="5" width="5" height="17" rx="1.5" fill="#E06518" />
    <rect x="18" y="24" width="17" height="5" rx="1.5" fill="#E06518" />
    <rect x="24" y="18" width="5" height="17" rx="1.5" fill="#E06518" />
    <rect x="24" y="11" width="11" height="5" rx="1.5" fill="#E06518" />
    <rect x="5" y="24" width="11" height="5" rx="1.5" fill="#E06518" />
    <rect x="11" y="24" width="5" height="11" rx="1.5" fill="#E06518" />
    <rect x="24" y="5" width="5" height="11" rx="1.5" fill="#E06518" />
  </svg>
);

export const AiFloatingButton: React.FC = () => {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="store-assistant unified-ai-launcher"
      onClick={() => navigate("/ai-consult")}
      aria-label="باز کردن میزکار هوشمند FORZA"
    >
      <CognivoGeometricLogo size={29} />
      <span>میزکار FORZA</span>
    </button>
  );
};
