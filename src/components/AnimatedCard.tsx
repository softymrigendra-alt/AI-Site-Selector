import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';

interface Props extends HTMLMotionProps<'div'> {
  delay?: number;
  children: React.ReactNode;
}

export function AnimatedCard({ delay = 0, children, className, ...rest }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: 'easeOut' }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function FadeIn({ delay = 0, children, className, ...rest }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay, ease: 'easeOut' }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function SlideIn({ delay = 0, children, className, ...rest }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay, ease: 'easeOut' }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

interface TabPanelProps {
  children: React.ReactNode;
  tabKey: string;
  className?: string;
}

export function TabPanel({ children, tabKey, className }: TabPanelProps) {
  return (
    <motion.div
      key={tabKey}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
