import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
export const AiConsultModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  onOpenVisualSearch?: () => void;
}> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  useEffect(() => {
    if (isOpen) {
      onClose();
      navigate("/ai-consult");
    }
  }, [isOpen, navigate, onClose]);
  return null;
};
