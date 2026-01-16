'use client';

interface LevelUpModalProps {
  newLevel: number;
  onClose: () => void;
}

export function LevelUpModal({ newLevel, onClose }: LevelUpModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-gradient-to-br from-orange-900 via-orange-950 to-black border-4 border-orange-700 rounded-lg max-w-md w-full shadow-2xl animate-pulse">
        <div className="p-8 text-center">
          <div className="mb-6">
            <div className="inline-block px-8 py-4 bg-gradient-to-br from-orange-600 to-orange-800 rounded-full border-4 border-orange-500 shadow-lg mb-4">
              <div className="text-6xl font-bold text-orange-100">{newLevel}</div>
            </div>
          </div>
          
          <h2 className="text-4xl font-bold text-orange-400 mb-4">
            LEVEL UP!
          </h2>
          
          <p className="text-orange-200 text-lg mb-6">
            Congratulations, brave adventurer!
          </p>
          
          <p className="text-orange-300 mb-8">
            You have reached <span className="font-bold text-orange-400">Level {newLevel}</span>!
          </p>
          
          <p className="text-orange-200 text-sm mb-6 italic">
            &quot;With each level gained, new powers and legendary equipment await those who prove their worth.&quot;
          </p>
          
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-orange-700 text-white rounded-lg hover:bg-orange-600 transition-colors border-2 border-orange-600 font-semibold text-lg shadow-lg"
          >
            Continue Your Journey
          </button>
        </div>
      </div>
    </div>
  );
}

