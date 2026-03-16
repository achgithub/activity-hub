import React, { useEffect } from 'react';

interface ChallengeToastProps {
  fromUser: string;
  appId: string;
  onDismiss: () => void;
}

const ChallengeToast: React.FC<ChallengeToastProps> = ({
  fromUser,
  appId,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 5000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="ah-banner ah-banner--info fixed bottom-4 left-4 right-4 md:right-auto md:w-96 flex items-center gap-3">
      <div className="text-xl">⚔️</div>
      <p>
        <strong>{fromUser}</strong> challenges you to <strong>{appId}</strong>
      </p>
    </div>
  );
};

export default ChallengeToast;
