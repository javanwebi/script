import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
/** Preserve old URLs while using the same authentication popup as the header. */
export const LoginPage = () => {
  const navigate = useNavigate();
  const { openAuthModal } = useAuth();
  useEffect(() => {
    navigate("/", { replace: true });
    openAuthModal(undefined, "login");
  }, [navigate, openAuthModal]);
  return null;
};
