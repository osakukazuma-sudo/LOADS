import { createContext, useContext } from 'react';
export const AccountOwnerContext = createContext('');
export function useAccountOwner() { return useContext(AccountOwnerContext); }
