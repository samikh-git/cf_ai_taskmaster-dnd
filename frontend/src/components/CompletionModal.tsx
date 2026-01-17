'use client';

interface CompletionModalProps {
  narrative: string;
  xpEarned: number;
  onClose: () => void;
}

export function CompletionModal({ narrative, xpEarned, onClose }: CompletionModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-gradient-to-br from-orange-900 via-orange-950 to-black border-4 border-orange-700 rounded-lg max-w-2xl w-full shadow-2xl">
        <div className="p-8">
          <div className="mb-6 text-center">
            <h2 className="text-3xl font-bold text-orange-400 mb-2">
              Quest Completed!
            </h2>
            <div className="inline-block px-6 py-2 bg-orange-800 rounded-full border-2 border-orange-600 mb-4">
              <span className="text-orange-200 font-semibold">+{xpEarned} XP</span>
            </div>
          </div>

          <div className="mb-6">
            <div className="bg-black/30 rounded-lg p-6 border-2 border-orange-800">
              <h3 className="text-orange-500 font-semibold mb-3 text-lg">
                The Chronicler&apos;s Tale
              </h3>
              <p className="text-orange-200 leading-relaxed whitespace-pre-wrap italic">
                &quot;{narrative}&quot;
              </p>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={onClose}
              className="w-full px-6 py-3 bg-orange-700 text-white rounded-lg hover:bg-orange-600 transition-colors border-2 border-orange-600 font-semibold text-lg shadow-lg"
            >
              Continue Your Journey
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
