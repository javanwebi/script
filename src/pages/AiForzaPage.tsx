import React, { lazy, Suspense } from 'react';
import '../components/forza/style.css';
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
      <Suspense fallback={
        <div className="forza-entry-fallback" role="status" aria-label="در حال آماده‌سازی تماس FORZA">
          <div className="forza-entry-fallback__label">
            <span className="forza-entry-fallback__dot" />
            <span>در حال آماده‌سازی محیط هوشمند فورزا...</span>
          </div>
        </div>
      }>
        <AiForzaCallExperience onClose={() => navigate('/')} />
      </Suspense>
    </div>
  );
};
