import React, { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';

const AiForzaCallExperience = lazy(() =>
  import('../components/forza/AiForzaCallExperience').then(module => ({
    default: module.AiForzaCallExperience,
  })),
);

export const AiForzaPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="w-screen h-screen min-h-[100svh] max-h-[100dvh] overflow-hidden bg-[#080402] p-0 m-0">
      <Suspense fallback={<div className="w-full h-full min-h-[100svh] bg-[#080402]" aria-label="در حال آماده‌سازی تماس FORZA" />}>
        <AiForzaCallExperience onClose={() => navigate('/')} />
      </Suspense>
    </div>
  );
};
