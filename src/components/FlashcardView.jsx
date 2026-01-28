import { useState, useEffect } from 'react';
import { Check, X, ArrowRight } from 'lucide-react';

export default function FlashcardView({ card, selectedAnswer, setSelectedAnswer, isAnswered, onSubmit }) {
  const [localSelected, setLocalSelected] = useState(selectedAnswer);

  useEffect(() => {
    setLocalSelected(selectedAnswer);
  }, [selectedAnswer, card]);

  const handleSelect = (index) => {
    if (isAnswered) return; // Can't change after answering
    setLocalSelected(index);
    setSelectedAnswer(index);
  };

  const handleSubmit = () => {
    if (localSelected === null || localSelected === undefined) return;
    onSubmit();
  };

  const getOptionStyle = (index) => {
    const baseStyle = "w-full p-4 text-left rounded-lg border-2 transition-all ";
    
    if (!isAnswered) {
      // Before answering
      if (localSelected === index) {
        return baseStyle + "border-indigo-500 bg-indigo-50 text-indigo-900";
      }
      return baseStyle + "border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50 text-slate-700";
    }
    
    // After answering
    const isCorrect = index === card.correctIndex;
    const isSelected = localSelected === index;
    
    if (isCorrect) {
      return baseStyle + "border-green-500 bg-green-50 text-green-900";
    }
    if (isSelected && !isCorrect) {
      return baseStyle + "border-red-500 bg-red-50 text-red-900";
    }
    return baseStyle + "border-slate-200 bg-slate-50 text-slate-500";
  };

  const conceptLabels = {
    main_contribution: 'Key Contribution',
    technical: 'Technical Insight',
    comparison: 'Comparison',
    practical: 'Practical'
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6">
        {/* Tags */}
        <div className="flex items-center gap-2 mb-4">
          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
            {conceptLabels[card.concept] || card.concept}
          </span>
          {card.relatedPaper && (
            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
              vs {card.relatedPaper.length > 30 ? card.relatedPaper.slice(0, 30) + '...' : card.relatedPaper}
            </span>
          )}
        </div>
        
        {/* Question */}
        <p className="text-lg text-slate-800 leading-relaxed mb-6">{card.question}</p>
        
        {/* Options */}
        <div className="space-y-3">
          {card.options?.map((option, index) => (
            <button
              key={index}
              onClick={() => handleSelect(index)}
              disabled={isAnswered}
              className={getOptionStyle(index)}
            >
              <div className="flex items-center gap-3">
                <span className="flex-1">{option}</span>
                {isAnswered && index === card.correctIndex && (
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                )}
                {isAnswered && localSelected === index && index !== card.correctIndex && (
                  <X className="w-5 h-5 text-red-600 flex-shrink-0" />
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Explanation after answering */}
        {isAnswered && card.explanation && (
          <div className={`mt-6 p-4 rounded-lg ${
            localSelected === card.correctIndex 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-amber-50 border border-amber-200'
          }`}>
            <p className={`text-sm font-medium mb-1 ${
              localSelected === card.correctIndex ? 'text-green-800' : 'text-amber-800'
            }`}>
              {localSelected === card.correctIndex ? '✓ Correct!' : '✗ Not quite'}
            </p>
            <p className={`text-sm ${
              localSelected === card.correctIndex ? 'text-green-700' : 'text-amber-700'
            }`}>
              {card.explanation}
            </p>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
        {!isAnswered ? (
          <button
            onClick={handleSubmit}
            disabled={localSelected === null || localSelected === undefined}
            className="px-6 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            Check Answer
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={onSubmit}
            className="px-6 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors flex items-center gap-2"
          >
            Next Question
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
