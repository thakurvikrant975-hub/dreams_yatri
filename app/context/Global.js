"use client";
import { createContext, useContext } from "react";

const ContactContext = createContext();

export const GlobalProvider = ({ children }) => {
  const contactData = {
    sales: {
      label: "Call Sales",
      phone: "+91-9999999999",
      phoneUrl: "tel:+91-9999999999",
      email: "sales@dreamsyatri.com",
      emailUrl: "mailto:sales@dreamsyatri.com"
    },
    support: {
      label: "Call Support",
      phone: "+91-9123456780",
      phoneUrl: "tel:+91-9123456780",
      email: "support@dreamsyatri.com",
      emailUrl: "mailto:support@dreamsyatri.com"
    },
    whatsapp: {
      label: "WhatsApp Us",
      phone: "+91-9988776655",
      phoneUrl: "https://wa.me/+91-9988776655",
      email: "whatsapp@dreamsyatri.com",
      emailUrl: "mailto:whatsapp@dreamsyatri.com"
    },
  };

  return (
    <ContactContext.Provider value={contactData}>
      {children}
    </ContactContext.Provider>
  );
};

// Custom hook (cleaner usage)
export const useContact = () => useContext(ContactContext);