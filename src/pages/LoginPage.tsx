import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
/** Preserve old URLs while using the same authentication popup as the header. */
export const LoginPage = () => {
  const opened = useRef(false);
  const navigate = useNavigate();
  const { openAuthModal } = useAuth();
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    navigate("/", { replace: true });
    openAuthModal(undefined, "login");
  }, [navigate, openAuthModal]);
  return null;
};
