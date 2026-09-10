import React from 'react';

interface AcademyLogoProps {
  src?: string | null;
  name?: string;
  size?: number;
  className?: string;
}

/**
 * Always sits on a white plate so dark academy marks stay readable.
 */
export const AcademyLogo: React.FC<AcademyLogoProps> = ({
  src,
  name = 'Academy',
  size = 40,
  className = '',
}) => {
  const initial = (name.trim().charAt(0) || 'A').toUpperCase();
  return (
    <div
      className={`shrink-0 rounded-xl border border-slate-200 bg-white flex items-center justify-center overflow-hidden ${className}`}
      style={{ width: size, height: size }}
      title={name}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-contain p-0.5 bg-white" />
      ) : (
        <span className="text-slate-800 font-extrabold tracking-tight" style={{ fontSize: Math.max(12, size * 0.38) }}>
          {initial}
        </span>
      )}
    </div>
  );
};
