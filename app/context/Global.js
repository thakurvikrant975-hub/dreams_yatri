"use client";
import { head } from "motion/react-client";
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
      phone: "+91-8888888888",
      phoneUrl: "tel:+91-8888888888",
      email: "support@dreamsyatri.com",
      emailUrl: "mailto:support@dreamsyatri.com"
    },
    finance: {
      label: "Finance Support",
      phone: "+91-7777777777",
      phoneUrl: "tel:+91-7777777777",
      email: "finance@dreamsyatri.com",
      emailUrl: "mailto:finance@dreamsyatri.com"
    },
    whatsapp: {
      label: "WhatsApp Us",
      phone: "+91-9988776655",
      phoneUrl: "https://wa.me/+91-9988776655",
      email: "whatsapp@dreamsyatri.com",
      emailUrl: "mailto:whatsapp@dreamsyatri.com"
    },
  };

  const siteData = {
    companyName: "DreamYatri",
    tripsCompleted: "10,000+",
    successRate: "99%",
    googleRating : "4.1",
    totalDestinations: "50+",
    experience: "5+ Years",
    headoffice: {
      address: "First Floor STPI Building, Kusumpti, Shimla, HP, India",
      phone: "+91-1234567890",
      email: "hi@dreamsyatri.com"
    }
  };

  const socialLinks = {
    youtube: "https://www.youtube.com/@dreamsyatri",
    instagram: "https://www.instagram.com/dreamsyatri",
    twitter: "https://twitter.com/dreamsyatri",
    facebook: "https://www.facebook.com/dreamsyatri",
    linkedin: "https://www.linkedin.com/company/dreamsyatri",
    whatsapp: "https://api.whatsapp.com/send/?phone=919812345678&text&type=phone_number&app_absent=0",
  };

  return (
    <ContactContext.Provider value={contactData}>
      {children}
    </ContactContext.Provider>
  );
};

// Custom hook (cleaner usage)
export const useContact = () => useContext(ContactContext);