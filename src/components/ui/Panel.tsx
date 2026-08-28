import React, { ReactNode } from 'react';
import styles from './Panel.module.css';

export interface PanelProps {
  position?: 'left' | 'right';
  className?: string;
  children: ReactNode;
}

export const Panel: React.FC<PanelProps> = ({ position = 'left', className = '', children }) => {
  const classes = [
    styles.panel,
    styles[position],
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {children}
    </div>
  );
};
