import React, { createContext, useContext, useState } from 'react';

const HelpContext = createContext();

export function useHelp() {
  return useContext(HelpContext);
}

export function HelpProvider({ children }) {
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [unreadSupportCount, setUnreadSupportCount] = useState(0);

  const openAi = () => {
    setIsAiOpen(true);
    setIsSupportOpen(false);
  };
  
  const closeAi = () => setIsAiOpen(false);

  const openSupport = () => {
    setIsSupportOpen(true);
    setIsAiOpen(false);
  };
  
  const closeSupport = () => setIsSupportOpen(false);

  return (
    <HelpContext.Provider value={{ 
      isAiOpen, openAi, closeAi, 
      isSupportOpen, openSupport, closeSupport,
      unreadSupportCount, setUnreadSupportCount
    }}>
      {children}
    </HelpContext.Provider>
  );
}
