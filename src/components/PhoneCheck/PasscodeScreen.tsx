import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Delete } from 'lucide-react';

interface Props {
  passcode: string;
  onUnlock: () => void;
  onClose: () => void;
}

export default function PasscodeScreen({ passcode, onUnlock, onClose }: Props) {
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const codeLength = passcode.length || 4;

  useEffect(() => {
    if (input.length === codeLength) {
      if (input === passcode) {
        onUnlock();
      } else {
        setError(true);
        setTimeout(() => {
          setError(false);
          setInput('');
        }, 500);
      }
    }
  }, [input, passcode, codeLength, onUnlock]);

  const handlePad = (num: string) => {
    if (input.length < codeLength) {
      setInput(prev => prev + num);
    }
  };

  const handleDel = () => {
    setInput(prev => prev.slice(0, -1));
  };

  return (
    <motion.div
      initial={{ scale: 1.1, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className="absolute inset-0 flex flex-col items-center pt-32 px-10 bg-black/50 backdrop-blur-3xl text-white z-50"
    >
      <h2 className="text-xl font-medium mb-8">输入密码</h2>

      <motion.div
        animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="flex space-x-4 mb-20"
      >
        {Array.from({ length: codeLength }).map((_, i) => (
          <div
            key={i}
            className={
              'w-3.5 h-3.5 rounded-full border-2 border-white transition-colors duration-200 ' +
              (i < input.length ? 'bg-white' : 'bg-transparent')
            }
          />
        ))}
      </motion.div>

      <div className="grid grid-cols-3 gap-x-8 gap-y-6">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
          <button
            key={num}
            onClick={() => handlePad(num)}
            className="w-16 h-16 rounded-full bg-white/10 hover:bg-white/30 active:bg-white/40 flex items-center justify-center text-3xl font-light transition-colors"
          >
            {num}
          </button>
        ))}
        <div className="flex items-center justify-center">
          <button onClick={onClose} className="text-sm font-medium opacity-70 hover:opacity-100">
            取消
          </button>
        </div>
        <button
          onClick={() => handlePad('0')}
          className="w-16 h-16 rounded-full bg-white/10 hover:bg-white/30 active:bg-white/40 flex items-center justify-center text-3xl font-light transition-colors"
        >
          0
        </button>
        <button
          onClick={handleDel}
          className="w-16 h-16 rounded-full bg-transparent hover:bg-white/10 flex items-center justify-center transition-colors"
        >
          <Delete size={24} />
        </button>
      </div>
    </motion.div>
  );
}
