import React, { ButtonHTMLAttributes } from 'react';
import styles from './IconButton.module.css';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  size?: 'sm' | 'md';
  title: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  active = false,
  size = 'md',
  title,
  className = '',
  children,
  disabled,
  ...props
}) => {
  const classes = [
    styles.iconButton,
    styles[size],
    active ? styles.active : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <button 
      className={classes} 
      title={title} 
      disabled={disabled}
      aria-label={title}
      {...props}
    >
      {children}
    </button>
  );
};
