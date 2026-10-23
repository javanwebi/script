import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
/** Registration always opens the shared popup, never a separate form page. */
export const RegisterPage = () => {
  const navigate = useNavigate();
  const { openAuthModal } = useAuth();
  useEffect(() => {
    navigate("/", { replace: true });
    openAuthModal(undefined, "register");
  }, [navigate, openAuthModal]);
  return null;
};
