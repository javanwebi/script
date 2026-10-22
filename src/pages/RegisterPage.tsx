import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Layers } from "lucide-react";
import { AccountAccess } from "../components/auth/AccountAccess";
export const RegisterPage = () => (
  <div className="account-page">
    <Link to="/" className="account-page-home">
      <Layers size={18} /> صنعت پیش{" "}
      <span style={{ marginRight: "auto" }}>بازگشت به سایت</span>
      <ArrowRight size={16} />
    </Link>
    <AccountAccess initial="register" />
  </div>
);
