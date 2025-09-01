class BarcodeParser {
    static BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    static BASE36_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    static decodeBase32ToDODID(encodedString) {
        try {
            if (!encodedString || typeof encodedString !== 'string') {
                return null;
            }

            const cleanInput = encodedString.toUpperCase().trim();
            
            if (cleanInput.length !== 7) {
                return null; 
            }

            
            
            let result = 0;
            const base = 32;
            
            for (let i = 0; i < cleanInput.length; i++) {
                const char = cleanInput[i];
                let value;
                
                if (char >= '0' && char <= '9') {
                    value = parseInt(char);
                } else if (char >= 'A' && char <= 'Z') {
                    value = char.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
                } else {
                    return null; 
                }
                
                
                if (value >= base) {
                    return null;
                }
                
                result = result * base + value;
            }
            
            const dodId = result.toString();
            
            
            if (/^\d+$/.test(dodId) && dodId.length >= 7 && dodId.length <= 12) {
                return dodId;
            }

            return null;
        } catch (error) {
            console.error('Error decoding base32:', error);
            return null;
        }
    }

    static parseSoldierInfo(barcodeData) {
        try {
            if (!barcodeData || typeof barcodeData !== 'string') {
                throw new Error('Invalid barcode data');
            }

            
            const cleanData = barcodeData.trim();
            
            
            const lines = cleanData.split('\n').map(line => line.trim());
            
            if (lines.length < 1) {
                throw new Error('Insufficient barcode data - expected at least 1 line');
            }

            const line1 = lines[0];


            
            
            const from17 = line1.slice(16);

// Allow any non-digit, non-space characters after the initial capital for first/last
const nameMatch = from17.match(/([A-Z][^\d\s]+)\s+([A-Z])([A-Z][^\d\s]+)\s/);

let firstName, middleInitial, lastName;

if (nameMatch) {
  firstName = nameMatch[1];
  middleInitial = nameMatch[2];
  lastName = nameMatch[3];
} else {
  const words = from17.split(/\s+/).filter(word => word.length > 0);
  // Match First/Last as: capital letter followed by non-digit, non-space chars
  const nameWords = words.filter(word => /^[A-Z][^\d\s]+$/.test(word));

  if (nameWords.length >= 2) {
    firstName = nameWords[0];
    lastName = nameWords[1];

    const singleLetters = from17.match(/\s([A-Z])\s/g);
    if (singleLetters && singleLetters.length > 0) {
      middleInitial = singleLetters[0].trim();
    }
  }
}

            
            
            let rank = null;
            
            
            const commonRanks = ['PVT', 'PV2', 'PFC', 'SPC', 'CPL', 'SGT', 'SSG', 'SFC', 'MSG', 'SGM', 'CSM',
                               '2LT', '1LT', 'CPT', 'MAJ', 'LTC', 'COL', 'BG', 'MG', 'LTG', 'GEN'];
            
            for (const possibleRank of commonRanks) {
                if (line1.includes(possibleRank)) {
                    rank = possibleRank;
                    break;
                }
            }
            
            
            if (!rank) {
                const rankMatch = line1.match(/([A-Z]{2,4})\s+/);
                if (rankMatch) {
                    rank = rankMatch[1];
                }
            }

            
            let dodId = null;
            
            
            if (line1.length > 8) {
                const dodIdCandidate = line1.substring(1, 8); 
                const decoded = this.decodeBase32ToDODID(dodIdCandidate);
                if (decoded) {
                    dodId = decoded;
                }
            }
            
            
            if (!dodId) {
                const base32Match = line1.match(/([A-Z2-7]{10,20})/g);
                if (base32Match) {
                    
                    for (const candidate of base32Match) {
                        const decoded = this.decodeBase32ToDODID(candidate);
                        if (decoded) {
                            dodId = decoded;
                            break;
                        }
                    }
                }
            }
            
            
            if (!dodId) {
                const dodIdMatch = cleanData.match(/(\d{10})/);
                if (dodIdMatch) {
                    dodId = dodIdMatch[1];
                }
            }

            
            if (!firstName || !lastName) {
                throw new Error('Could not parse first name and last name from barcode data');
            }

            return {
                firstName: firstName,
                middleInitial: middleInitial || '',
                lastName: lastName,
                rank: rank || 'UNK',
                dodId: dodId || '',
                fullName: `${firstName} ${middleInitial ? middleInitial + ' ' : ''}${lastName}`,
                rawData: barcodeData
            };

        } catch (error) {
            console.error('Error parsing barcode data:', error);
            return null;
        }
    }

    static validateSoldierInfo(soldierInfo) {
        if (!soldierInfo) return false;
        
        return (
            soldierInfo.firstName && 
            soldierInfo.lastName && 
            soldierInfo.firstName.length > 0 && 
            soldierInfo.lastName.length > 0
        );
    }

    static formatSoldierInfo(soldierInfo) {
        if (!soldierInfo) return 'Invalid soldier information';
        
        const rank = soldierInfo.rank !== 'UNK' ? soldierInfo.rank + ' ' : '';
        const middle = soldierInfo.middleInitial ? soldierInfo.middleInitial + ' ' : '';
        
        return `${rank}${soldierInfo.firstName} ${middle}${soldierInfo.lastName}`;
    }
}


if (typeof module !== 'undefined' && module.exports) {
    module.exports = BarcodeParser;
} else if (typeof window !== 'undefined') {
    window.BarcodeParser = BarcodeParser;
}

export default BarcodeParser;
