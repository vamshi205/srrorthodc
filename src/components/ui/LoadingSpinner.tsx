import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
  subtext?: string;
  className?: string;
}

export const AppLoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = 'Loading Data & Resources...',
  subtext = 'Please wait a moment',
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 sm:p-12 w-full min-h-[280px] font-sans ${className}`}>
      <div className="relative flex items-center justify-center mb-6">
        {/* Outer glowing blur ring */}
        <div className="absolute w-20 h-20 rounded-full bg-gradient-to-tr from-teal-500 via-emerald-400 to-cyan-500 blur-md opacity-45 animate-pulse"></div>

        {/* Outer rotating ring */}
        <div className="w-16 h-16 rounded-full border-3 border-transparent border-t-teal-600 border-r-emerald-500 animate-spin"></div>

        {/* Inner counter-rotating ring */}
        <div className="absolute w-10 h-10 rounded-full border-3 border-transparent border-b-cyan-500 border-l-teal-400 animate-[spin_1.2s_linear_infinite_reverse]"></div>

        {/* Pulsing center dot */}
        <div className="absolute w-3 h-3 bg-teal-600 rounded-full shadow-xs animate-ping"></div>
      </div>

      <h3 className="text-base font-bold text-slate-800 tracking-tight mb-1 flex items-center gap-1.5">
        <span>{message}</span>
        <span className="flex gap-1 items-center">
          <span className="w-1.5 h-1.5 bg-teal-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
          <span className="w-1.5 h-1.5 bg-teal-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
          <span className="w-1.5 h-1.5 bg-teal-600 rounded-full animate-bounce"></span>
        </span>
      </h3>

      {subtext && (
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{subtext}</p>
      )}
    </div>
  );
};
