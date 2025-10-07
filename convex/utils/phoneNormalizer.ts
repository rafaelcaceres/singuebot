/**
 * Utilities for normalizing Brazilian phone numbers
 * Handles the mandatory 9th digit addition in Brazilian mobile numbers
 */

/**
 * Normalizes a phone number to the standard format with the 9th digit for Brazilian mobile numbers
 * @param phone - Phone number in various formats
 * @returns Normalized phone number with whatsapp: prefix
 */
export const normalizePhoneNumber = (phone: string): string => {
  if (!phone) return phone;
  
  // Remove whatsapp: prefix if present
  let cleanPhone = phone.replace(/^whatsapp:/, '');
  
  // Add + if not present and it's not already a full number
  if (!cleanPhone.startsWith('+')) {
    // If it's just digits, assume it's a Brazilian number
    if (/^\d+$/.test(cleanPhone)) {
      cleanPhone = '+55' + cleanPhone;
    } else {
      cleanPhone = '+' + cleanPhone;
    }
  }
  
  // Check if it's a Brazilian number
  if (cleanPhone.startsWith('+55')) {
    // Extract area code and number
    const withoutCountry = cleanPhone.substring(3); // Remove +55
    
    if (withoutCountry.length >= 10) {
      const areaCode = withoutCountry.substring(0, 2);
      const number = withoutCountry.substring(2);
      
      // Validate area code (11-99)
      const areaCodeNum = parseInt(areaCode, 10);
      if (areaCodeNum >= 11 && areaCodeNum <= 99) {
        // Check if it's a mobile number (starts with 9, 8, 7, or 6)
        const firstDigit = number.charAt(0);
        if (['9', '8', '7', '6'].includes(firstDigit)) {
          // ALWAYS ensure mobile numbers have 9 digits
          if (number.length === 8) {
            // If 8 digits, add the mandatory 9th digit
            cleanPhone = `+55${areaCode}9${number}`;
          } else if (number.length === 9) {
            // If already 9 digits, keep as is
            cleanPhone = `+55${areaCode}${number}`;
          } else if (number.length > 9) {
            // If more than 9 digits, truncate to 9
            cleanPhone = `+55${areaCode}${number.substring(0, 9)}`;
          }
        } else {
          // For landline numbers, keep original format
          cleanPhone = `+55${areaCode}${number}`;
        }
      }
    }
  }
  
  return `whatsapp:${cleanPhone}`;
};

/**
 * Generates equivalent phone number variations for Brazilian numbers
 * @param phone - Phone number to generate variations for
 * @returns Array of equivalent phone numbers (with and without 9th digit)
 */
export const getPhoneVariations = (phone: string): string[] => {
  const variations: string[] = [phone];
  
  // Remove whatsapp: prefix for processing
  const cleanPhone = phone.replace("whatsapp:", "");
  const digitsOnly = cleanPhone.replace(/[^\d+]/g, "");
  
  // Handle Brazilian numbers (+55 country code)
  if (digitsOnly.startsWith("+55")) {
    const withoutCountryCode = digitsOnly.substring(3); // Remove +55
    
    if (withoutCountryCode.length >= 10) {
      const areaCode = withoutCountryCode.substring(0, 2);
      const number = withoutCountryCode.substring(2);
      
      // Validate area code (11-99)
      const areaCodeNum = parseInt(areaCode, 10);
      if (areaCodeNum >= 11 && areaCodeNum <= 99) {
        // If number has 9 digits and starts with 9, also add 8-digit version
        if (number.length === 9 && number.startsWith("9")) {
          const without9 = number.substring(1); // Remove the 9
          const variation = `whatsapp:+55${areaCode}${without9}`;
          variations.push(variation);
        }
        // If number has 8 digits, also add 9-digit version
        else if (number.length === 8) {
          const with9 = `9${number}`;
          const variation = `whatsapp:+55${areaCode}${with9}`;
          variations.push(variation);
        }
      }
    }
  }
  
  return [...new Set(variations)]; // Remove duplicates
};

/**
 * Checks if two phone numbers are equivalent (considering 9th digit variations)
 * @param phone1 - First phone number
 * @param phone2 - Second phone number
 * @returns True if numbers are equivalent
 */
export const arePhoneNumbersEquivalent = (phone1: string, phone2: string): boolean => {
  const variations1 = getPhoneVariations(phone1);
  const variations2 = getPhoneVariations(phone2);
  
  // Check if any variation of phone1 matches any variation of phone2
  return variations1.some(v1 => variations2.includes(v1));
};

/**
 * Formats phone number for display (removes whatsapp: prefix)
 * @param phone - Phone number with whatsapp: prefix
 * @returns Formatted phone number for display
 */
export const formatPhoneForDisplay = (phone: string): string => {
  return phone.replace("whatsapp:", "");
};