import React, { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { goBackOrFallback } from '../utils/navigateBackOrFallback';

const AiForzaCallExperience = lazy(() =>
  import('../components/forza/ForzaQwenCallExperience').then(module => ({
    default: module.ForzaQwenCallExperience,
  })),
);

export const AiForzaPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="w-screen h-screen min-h-[100svh] max-h-[100dvh] overflow-hidden bg-[#080402] p-0 m-0">
      <Suspense fallback={<div className="w-full h-full min-h-[100svh] bg-[#080402]" aria-label="در حال آماده‌سازی تماس FORZA" />}>
        <AiForzaCallExperience onClose={() => goBackOrFallback(navigate, '/')} />
      </Suspense>
    </div>
  );
};
