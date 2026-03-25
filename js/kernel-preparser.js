// ============================================================================
// HELLO TAXI DISPATCH - KERNEL-PREPARSER.JS
// ============================================================================
// Deterministic Pre-Parser for dictation input
// Extracts structured data BEFORE LLM processing
// Populates Call Summary widget in real-time
//
// Dependencies: kernel-core.js (DATA, CONFIG)
// ============================================================================

(function() {
    'use strict';
    
    console.log('[PARSE] Loading kernel-preparser.js...');
    
    // ============================================================================
    // CONFIDENCE LEVELS
    // ============================================================================
    const CONFIDENCE = {
        HIGH: 'high',      // [GREEN] Exact match or clear pattern
        LOW: 'low',        // [YELLOW] Needs verification
        MISSING: 'missing' // [RED] Not detected
    };
    
    // ============================================================================
    // REGEX PATTERNS
    // ============================================================================
    const PATTERNS = {
        // Phone: 204-555-1234, 204.555.1234, 204 555 1234, 2045551234
        phone: /\b(\d{3})[-.\s]?(\d{3})[-.\s]?(\d{4})\b/g,
        
        // Phone without area code: 555-1234
        phoneShort: /\b(\d{3})[-.\s]?(\d{4})\b/g,
        
        // Street address: 123 Main Street, 456 Oak Ave
        streetAddress: /\b(\d+)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(St(?:reet)?|Ave(?:nue)?|Rd|Road|Dr(?:ive)?|Blvd|Boulevard|Hwy|Highway|Cres(?:cent)?|Ct|Court|Pl(?:ace)?|Way|Lane|Ln)\b/gi,
        
        // Just number + street name (no suffix) - lower confidence
        partialAddress: /\b(\d+)\s+([A-Za-z]+)\b/g,
        
        // Time patterns
        timeExact: /\b(at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)?\b/gi,
        timeHour: /\b(at\s+)?(\d{1,2})\s*(am|pm)\b/gi,
        timeRelative: /\b(in\s+)?(\d+)\s*(min(?:ute)?s?|hour?s?|half\s+(?:an?\s+)?hour)\b/gi,
        timeTomorrow: /\btomorrow\b/gi,
        timePrebook: /\bprebook\b/gi,
        
        // Name extraction patterns
        namePatterns: [
            /\b(?:this\s+is|my\s+name\s+is|i(?:'?m|\s+am)|name\s+is|it'?s|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/gi,
            /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:here|calling|speaking)\b/gi,
            // "your name please Barbara" / "name please it's Barbara" / "that's Barbara"
            /\b(?:your\s+name(?:\s+please)?|name\s+please(?:\s+it'?s)?|that'?s(?:\s+at)?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/gi,
            // After phone: "555-5555 Barbara" or "555-5555. Barbara"
            /\d{4}[.\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g,
            // Name before phone: "Nina 204 408 4830" or "Nina 204-555-1234"
            /^[\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+\d{3}[\s.-]?\d{3}[\s.-]?\d{4}/gm,
            // Name on line with phone (pasted format)
            /(?:^|\n)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+\d{3}/gm
        ],
        
        // Stop detection
        stopPatterns: /\b(?:stop\s+(?:at|by)|first\s+(?:stop|go\s+to)|then\s+(?:to|go\s+to)|and\s+then|(?:1st|2nd|3rd)\s+stop)\s+(.+?)(?=\s+(?:then|and|,|$))/gi,
        
        // Special notes keywords
        specialNotes: {
            wheelchair: /\b(wheelchair|wheel\s*chair|wchr?|handicap(?:ped)?|accessible)\b/gi,
            carSeat: /\b(car\s*seat|child\s*seat|booster|infant\s*seat)\b/gi,
            luggage: /\b(luggage|bags?|suitcase|baggage)\b/gi,
            airport: /\b(airport|yqm|ywg|flight)\b/gi,
            medical: /\b(medical|hospital|doctor|appointment|dialysis|clinic)\b/gi,
            callOnArrival: /\b(call\s+(?:when|on)\s+arriv(?:e|al)|phone\s+(?:when|on)\s+arriv(?:e|al)|ring\s+(?:when|on)\s+arriv(?:e|al))\b/gi,
            pets: /\b(dog|cat|pet|animal|service\s+animal)\b/gi,
            passengers: /\b(\d+)\s*(?:passengers?|people|persons?|pax)\b/gi,
            cash: /\b(cash|paying\s+cash)\b/gi,
            card: /\b(card|credit|debit|visa|mastercard|paying\s+(?:by\s+)?card)\b/gi,
            account: /\b(account|bill\s+(?:to|my)|charge\s+(?:to|my)|charge\s+[A-Z][\w.]*)\b/gi
        },
        
        // Noise words to filter
        noiseWords: /\b(um+|uh+|like|you\s+know|basically|actually|so+|well|okay|ok|yeah|yes|no|hi|hello|hey|thanks|thank\s+you|please|bye|goodbye)\b/gi
    };
    
    // ============================================================================
    // PRE-PARSER STATE
    // ============================================================================
    let parseDebounceTimer = null;
    const DEBOUNCE_MS = 400;
    
    // ============================================================================
    // EXTRACTION FUNCTIONS
    // ============================================================================
    
    /**
     * Extract phone number from text
     * @returns {Object} { value: string, confidence: string, raw: string }
     */
    function extractPhone(text) {
        // Try full phone with area code first
        const fullMatch = text.match(PATTERNS.phone);
        if (fullMatch && fullMatch.length > 0) {
            const raw = fullMatch[0];
            const digits = raw.replace(/\D/g, '');
            const formatted = `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6,10)}`;
            return { value: formatted, confidence: CONFIDENCE.HIGH, raw: raw };
        }
        
        // Try short phone (missing area code) - lower confidence
        const shortMatch = text.match(PATTERNS.phoneShort);
        if (shortMatch && shortMatch.length > 0) {
            const raw = shortMatch[0];
            const digits = raw.replace(/\D/g, '');
            // Default to 204 area code for Steinbach
            const formatted = `204-${digits.slice(0,3)}-${digits.slice(3,7)}`;
            return { value: formatted, confidence: CONFIDENCE.LOW, raw: raw };
        }
        
        return { value: '', confidence: CONFIDENCE.MISSING, raw: '' };
    }
    
    /**
     * Extract customer name from text
     * @returns {Object} { value: string, confidence: string, raw: string }
     */
    function extractName(text) {
        for (const pattern of PATTERNS.namePatterns) {
            pattern.lastIndex = 0; // Reset regex
            const match = pattern.exec(text);
            if (match && match[1]) {
                const name = match[1].trim();
                // Check if it looks like a real name (capitalized, reasonable length)
                if (name.length >= 2 && name.length <= 40) {
                    // Lower confidence for ethnic/unusual names (simple heuristic)
                    const isCommonPattern = /^[A-Z][a-z]+(\s+[A-Z][a-z]+)?$/.test(name);
                    return { 
                        value: name, 
                        confidence: isCommonPattern ? CONFIDENCE.HIGH : CONFIDENCE.LOW, 
                        raw: match[0] 
                    };
                }
            }
        }
        return { value: '', confidence: CONFIDENCE.MISSING, raw: '' };
    }
    
    /**
     * Match text against DATA.placeNicknames
     * @returns {Object|null} Matched nickname object or null
     */
    function matchNickname(text) {
        if (!DATA || !DATA.placeNicknames) return null;
        
        const lowerText = text.toLowerCase();
        
        for (const place of DATA.placeNicknames) {
            // Check nickname
            if (lowerText.includes(place.nickname.toLowerCase())) {
                return { ...place, matchedOn: 'nickname' };
            }
            // Check formal name
            if (lowerText.includes(place.formal.toLowerCase())) {
                return { ...place, matchedOn: 'formal' };
            }
        }
        return null;
    }
    
    /**
     * Match text against DATA.clients for recall
     * @returns {Object|null} Matched client or null
     */
    function matchClient(phone) {
        if (!DATA || !DATA.clients || !phone) return null;
        
        const digits = phone.replace(/\D/g, '');
        
        for (const client of DATA.clients) {
            const clientDigits = client.phone.replace(/\D/g, '');
            if (digits === clientDigits || digits.endsWith(clientDigits) || clientDigits.endsWith(digits)) {
                return client;
            }
        }
        return null;
    }
    
    /**
     * Extract location (pickup or dropoff) from text segment
     * @returns {Object} { value: string, confidence: string, raw: string, coords: array|null }
     */
    function extractLocation(text) {
        // First check for nickname matches (highest confidence)
        const nickname = matchNickname(text);
        if (nickname) {
            return {
                value: nickname.address,
                displayValue: nickname.formal,
                confidence: CONFIDENCE.HIGH,
                raw: nickname.matchedOn === 'nickname' ? nickname.nickname : nickname.formal,
                coords: nickname.coords
            };
        }
        
        // Try full street address pattern
        PATTERNS.streetAddress.lastIndex = 0;
        const streetMatch = PATTERNS.streetAddress.exec(text);
        if (streetMatch) {
            const address = streetMatch[0];
            return {
                value: address,
                displayValue: address,
                confidence: CONFIDENCE.HIGH,
                raw: address,
                coords: null
            };
        }
        
        // Try partial address (number + word) - lower confidence
        PATTERNS.partialAddress.lastIndex = 0;
        const partialMatch = PATTERNS.partialAddress.exec(text);
        if (partialMatch) {
            const partial = partialMatch[0];
            // Filter out things that are clearly not addresses
            if (!/^\d+\s+(am|pm|min|hour|passenger|people|person)$/i.test(partial)) {
                return {
                    value: partial,
                    displayValue: partial,
                    confidence: CONFIDENCE.LOW,
                    raw: partial,
                    coords: null
                };
            }
        }
        
        return { value: '', displayValue: '', confidence: CONFIDENCE.MISSING, raw: '', coords: null };
    }
    
    /**
     * Extract potential business/place name from text (not a street address)
     * Used when street address patterns don't match
     * @returns {Object} { value: string, confidence: string, needsGeocode: boolean }
     */
    function extractPotentialPlace(text, type) {
        // Patterns to find pickup/dropoff phrases with business names
        const patterns = {
            pickup: [
                /(?:from|at|pickup\s+(?:at|from)?)\s+(?:the\s+)?([A-Z][A-Za-z\s']+?)(?:\s+(?:to|going|heading|drop|at\s+\d)|[,.]|$)/gi,
                /^([A-Z][A-Za-z\s']+?)(?:\s+to\s+|\s*,)/gi
            ],
            dropoff: [
                /(?:to|drop\s*(?:off)?(?:\s+at)?|going\s+to|heading\s+to|destination)\s+(?:the\s+)?([A-Z][A-Za-z\s']+?)(?:\s+(?:at\s+\d|for|please)|[,.]|$)/gi,
                /to\s+(?:the\s+)?([A-Z][A-Za-z\s']+?)$/gi
            ]
        };
        
        const typePatterns = patterns[type] || patterns.dropoff;
        
        for (const pattern of typePatterns) {
            pattern.lastIndex = 0;
            const match = pattern.exec(text);
            if (match && match[1]) {
                const placeName = match[1].trim();
                // Filter out common non-place words
                if (placeName.length > 2 && 
                    !/^(and|the|for|with|please|thanks|asap|now|today|tomorrow)$/i.test(placeName) &&
                    !/^\d/.test(placeName)) {
                    return {
                        value: placeName,
                        displayValue: placeName,
                        confidence: CONFIDENCE.LOW,
                        raw: placeName,
                        coords: null,
                        needsGeocode: true
                    };
                }
            }
        }
        
        return null;
    }
    
    /**
     * Get local date string (YYYY-MM-DD) - avoids UTC timezone issues
     */
    function getLocalDateString(dateObj) {
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Extract time/prebook info from text
     * @returns {Object} { date: string, time: string, isPrebook: boolean, confidence: string }
     */
    function extractTime(text) {
        const now = new Date();
        let date = '';
        let time = '';
        let isPrebook = false;
        let confidence = CONFIDENCE.MISSING;
        
        // Check for "tomorrow"
        if (PATTERNS.timeTomorrow.test(text)) {
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            date = getLocalDateString(tomorrow);  // FIX: Use local date, not UTC
            isPrebook = true;
            confidence = CONFIDENCE.HIGH;
        }
        
        // Check for "prebook" keyword
        if (PATTERNS.timePrebook.test(text)) {
            isPrebook = true;
        }
        
        // Check for exact time (e.g., "at 2:30 pm")
        PATTERNS.timeExact.lastIndex = 0;
        let timeMatch = PATTERNS.timeExact.exec(text);
        if (timeMatch) {
            let hours = parseInt(timeMatch[2]);
            const mins = timeMatch[3] || '00';
            const ampm = (timeMatch[4] || '').toLowerCase();
            
            if (ampm === 'pm' && hours < 12) hours += 12;
            if (ampm === 'am' && hours === 12) hours = 0;
            
            // Smart inference when no AM/PM specified
            if (!ampm && hours >= 1 && hours <= 12) {
                const currentHour = now.getHours();
                // If it's currently afternoon/evening (12pm-11pm) and hour is 1-11,
                // assume they mean PM (e.g., "at 2:30" at 3pm means 2:30 PM, so tomorrow)
                // If hour has already passed today in PM, it's for tomorrow
                // If it's currently morning and they say a morning hour, keep AM
                if (currentHour >= 12) {
                    // Currently afternoon/evening
                    if (hours < 12) {
                        hours += 12; // Assume PM
                    }
                } else if (currentHour >= 6 && currentHour < 12) {
                    // Currently morning (6am-noon)
                    // If they say an hour less than current, assume PM
                    if (hours <= currentHour && hours !== 12) {
                        hours += 12; // Assume PM
                    }
                    // Otherwise keep as AM
                }
                // Note: 12 stays as 12 (noon) without AM/PM
                confidence = CONFIDENCE.LOW; // Lower confidence without explicit AM/PM
            }
            
            time = `${hours.toString().padStart(2, '0')}:${mins}`;
            isPrebook = true;
            if (ampm) confidence = CONFIDENCE.HIGH; // High confidence only if AM/PM was explicit
        }
        
        // Check for hour only (e.g., "at 5 pm")
        if (!time) {
            PATTERNS.timeHour.lastIndex = 0;
            timeMatch = PATTERNS.timeHour.exec(text);
            if (timeMatch) {
                let hours = parseInt(timeMatch[2]);
                const ampm = (timeMatch[3] || '').toLowerCase();
                
                if (ampm === 'pm' && hours < 12) hours += 12;
                if (ampm === 'am' && hours === 12) hours = 0;
                
                // Smart inference when no AM/PM specified (same logic as exact time)
                if (!ampm && hours >= 1 && hours <= 12) {
                    const currentHour = now.getHours();
                    if (currentHour >= 12) {
                        if (hours < 12) hours += 12;
                    } else if (currentHour >= 6 && currentHour < 12) {
                        if (hours <= currentHour && hours !== 12) hours += 12;
                    }
                    confidence = CONFIDENCE.LOW;
                }
                
                time = `${hours.toString().padStart(2, '0')}:00`;
                isPrebook = true;
                if (ampm) confidence = CONFIDENCE.HIGH;
            }
        }
        
        // Check for relative time (e.g., "in 30 minutes")
        if (!time) {
            PATTERNS.timeRelative.lastIndex = 0;
            timeMatch = PATTERNS.timeRelative.exec(text);
            if (timeMatch) {
                const amount = parseInt(timeMatch[2]);
                const unit = timeMatch[3].toLowerCase();
                
                const futureTime = new Date(now);
                if (unit.includes('hour')) {
                    futureTime.setHours(futureTime.getHours() + amount);
                } else if (unit.includes('half')) {
                    futureTime.setMinutes(futureTime.getMinutes() + 30);
                } else {
                    futureTime.setMinutes(futureTime.getMinutes() + amount);
                }
                
                date = getLocalDateString(futureTime);  // FIX: Use local date, not UTC
                time = `${futureTime.getHours().toString().padStart(2, '0')}:${futureTime.getMinutes().toString().padStart(2, '0')}`;
                isPrebook = true;
                confidence = CONFIDENCE.HIGH;
            }
        }
        
        // If we have time but no date, assume today
        if (time && !date) {
            date = getLocalDateString(now);  // FIX: Use local date, not UTC
        }
        
        return { date, time, isPrebook, confidence };
    }
    
    /**
     * Extract special notes from text
     * @returns {Object} { notes: string[], confidence: string }
     */
    function extractSpecialNotes(text) {
        const detected = [];
        
        for (const [key, pattern] of Object.entries(PATTERNS.specialNotes)) {
            pattern.lastIndex = 0;
            const match = pattern.exec(text);
            if (match) {
                switch(key) {
                    case 'wheelchair':
                        detected.push('Wheelchair');
                        break;
                    case 'carSeat':
                        detected.push('Car Seat');
                        break;
                    case 'luggage':
                        detected.push('Luggage');
                        break;
                    case 'airport':
                        detected.push('Airport');
                        break;
                    case 'medical':
                        detected.push('Medical');
                        break;
                    case 'callOnArrival':
                        detected.push('Call on arrival');
                        break;
                    case 'pets':
                        detected.push('Pet');
                        break;
                    case 'passengers':
                        detected.push(`${match[1]} passengers`);
                        break;
                    case 'cash':
                        detected.push('Cash');
                        break;
                    case 'card':
                        detected.push('Card');
                        break;
                    case 'account':
                        // Extract account name if present (e.g., "Charge E.A" -> "E.A")
                        const accountMatch = text.match(/charge\s+([A-Z][\w.]*)/i);
                        if (accountMatch) {
                            detected.push('Charge ' + accountMatch[1]);
                        } else {
                            detected.push('Account');
                        }
                        break;
                }
            }
        }
        
        return {
            notes: detected,
            confidence: detected.length > 0 ? CONFIDENCE.HIGH : CONFIDENCE.MISSING
        };
    }
    
    /**
     * Extract stops/waypoints from text
     * @returns {Array} Array of { value: string, confidence: string, waitTime: number }
     */
    function extractStops(text) {
        const stops = [];
        
        PATTERNS.stopPatterns.lastIndex = 0;
        let match;
        while ((match = PATTERNS.stopPatterns.exec(text)) !== null) {
            const stopText = match[1].trim();
            const location = extractLocation(stopText);
            
            // Check for wait time
            const waitMatch = stopText.match(/(\d+)\s*min/i);
            const waitTime = waitMatch ? parseInt(waitMatch[1]) : 0;
            
            if (location.value || stopText.length > 2) {
                stops.push({
                    value: location.value || stopText,
                    displayValue: location.displayValue || stopText,
                    confidence: location.confidence || CONFIDENCE.LOW,
                    waitTime: waitTime,
                    coords: location.coords
                });
            }
        }
        
        return stops;
    }
    
    /**
     * Clean text by removing noise words
     */
    function cleanText(text) {
        // Preserve newlines (pasted clipboard formats use line structure like "from:" / "to:")
        const normalized = (text || '').replace(/\r\n/g, '\n');
        return normalized
            .replace(PATTERNS.noiseWords, ' ')
            // normalize spaces but keep newlines
            .split('\n')
            .map(line => line.replace(/\s+/g, ' ').trim())
            .join('\n')
            .trim();
    }
    
    // ============================================================================
    // MAIN PARSE FUNCTION
    // ============================================================================
    
    /**
     * Parse dictation text and return structured data
     * @param {string} rawText - Raw dictation input
     * @returns {Object} Parsed data with confidence levels
     */
    function parse(rawText) {
        const text = cleanText(rawText);
        
        // Extract all fields
        const phone = extractPhone(text);
        const name = extractName(text);
        const time = extractTime(text);
        const specialNotes = extractSpecialNotes(text);
        const stops = extractStops(text);
        
        // For pickup/dropoff, we need smarter segmentation
        // Look for patterns like "from X to Y", "pickup X dropoff Y", "at X going to Y"
        let pickup = { value: '', displayValue: '', confidence: CONFIDENCE.MISSING, coords: null };
        let dropoff = { value: '', displayValue: '', confidence: CONFIDENCE.MISSING, coords: null };
        
        // Try labeled format first: "from: X" and "to: Y" on separate lines (pasted clipboard)
        // Use the newline-preserving text so the format is stable.
        const labeledFromMatch = text.match(/(?:^|\n)\s*from[:\s]+(.+?)(?=\n|\s*to[:\s]|\s*notes[:\s]|\s*charge[:\s]|$)/i);
        const labeledToMatch = text.match(/(?:^|\n)\s*to[:\s]+(.+?)(?=\n|\s*notes[:\s]|\s*charge[:\s]|$)/i);
        
        if (labeledFromMatch && labeledToMatch) {
            const pickupText = labeledFromMatch[1].trim();
            const dropoffText = labeledToMatch[1].trim();
            
            pickup = extractLocation(pickupText);
            dropoff = extractLocation(dropoffText);
            
            // If not recognized as address, treat as place name needing geocoding
            if (!pickup.value || pickup.confidence === CONFIDENCE.MISSING) {
                pickup = {
                    value: pickupText,
                    displayValue: pickupText,
                    confidence: CONFIDENCE.LOW,
                    raw: pickupText,
                    coords: null,
                    needsGeocode: true
                };
            }
            if (!dropoff.value || dropoff.confidence === CONFIDENCE.MISSING) {
                dropoff = {
                    value: dropoffText,
                    displayValue: dropoffText,
                    confidence: CONFIDENCE.LOW,
                    raw: dropoffText,
                    coords: null,
                    needsGeocode: true
                };
            }
        }
        
        // Try "from X to Y" pattern - improved to handle parentheses and informal names
        const fromToMatch = !labeledFromMatch && text.match(/(?:from|at|pickup(?:\s+at)?)\s+(.+?)\s+(?:to|going\s+to|drop(?:off)?(?:\s+at)?|heading\s+to)\s+(.+?)(?:\s+(?:stop|then|and|for|please|wheelchair|car\s*seat|luggage)|$)/i);
        if (fromToMatch) {
            const pickupText = fromToMatch[1].trim();
            const dropoffText = fromToMatch[2].trim();
            
            pickup = extractLocation(pickupText);
            dropoff = extractLocation(dropoffText);
            
            // If dropoff wasn't recognized as address, treat as place name needing geocoding
            if (!dropoff.value || dropoff.confidence === CONFIDENCE.MISSING) {
                // Clean up text in parentheses (e.g., "Resthaven (Back)" -> "Resthaven")
                const cleanDropoff = dropoffText.replace(/\s*\([^)]*\)\s*/g, '').trim();
                if (cleanDropoff.length > 0) {
                    dropoff = {
                        value: cleanDropoff,
                        displayValue: cleanDropoff,
                        confidence: CONFIDENCE.LOW,
                        raw: dropoffText,
                        coords: null,
                        needsGeocode: true
                    };
                }
            }
            
            // Same for pickup
            if (!pickup.value || pickup.confidence === CONFIDENCE.MISSING) {
                const cleanPickup = pickupText.replace(/\s*\([^)]*\)\s*/g, '').trim();
                if (cleanPickup.length > 0 && !/^\d+$/.test(cleanPickup)) {
                    pickup = {
                        value: cleanPickup,
                        displayValue: cleanPickup,
                        confidence: CONFIDENCE.LOW,
                        raw: pickupText,
                        coords: null,
                        needsGeocode: true
                    };
                }
            }
        } else {
            // Try to find any addresses and use first as pickup, last as dropoff
            const allAddresses = [];
            const allPlaceNames = [];
            
            // Find all street addresses
            PATTERNS.streetAddress.lastIndex = 0;
            let addrMatch;
            while ((addrMatch = PATTERNS.streetAddress.exec(text)) !== null) {
                allAddresses.push({ text: addrMatch[0], index: addrMatch.index, type: 'address' });
            }
            
            // Also check for nicknames
            if (DATA && DATA.placeNicknames) {
                for (const place of DATA.placeNicknames) {
                    const nickIdx = text.toLowerCase().indexOf(place.nickname.toLowerCase());
                    if (nickIdx !== -1) {
                        allAddresses.push({ 
                            text: place.nickname, 
                            index: nickIdx, 
                            resolved: place,
                            type: 'nickname'
                        });
                    }
                }
            }
            
            // Also look for capitalized words that might be place names (Sobeys, Walmart, etc)
            // Match capitalized words not part of street addresses
            const capitalizedWords = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g);
            if (capitalizedWords) {
                for (const word of capitalizedWords) {
                    // Skip if it's part of a known address
                    const isPartOfAddress = allAddresses.some(addr => addr.text.includes(word));
                    if (!isPartOfAddress) {
                        const wordIdx = text.indexOf(word);
                        // Skip names and common words
                        if (!/^(Rebecca|January|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i.test(word)) {
                            allPlaceNames.push({ text: word, index: wordIdx, type: 'place' });
                        }
                    }
                }
            }
            
            // Combine addresses and place names
            const allLocations = [...allAddresses, ...allPlaceNames];
            
            // Sort by position in text
            allLocations.sort((a, b) => a.index - b.index);
            
            if (allLocations.length >= 1) {
                const first = allLocations[0];
                if (first.resolved) {
                    pickup = {
                        value: first.resolved.address,
                        displayValue: first.resolved.formal,
                        confidence: CONFIDENCE.HIGH,
                        coords: first.resolved.coords
                    };
                } else if (first.type === 'address') {
                    pickup = extractLocation(first.text);
                } else {
                    // Place name - needs geocoding
                    pickup = {
                        value: first.text,
                        displayValue: first.text,
                        confidence: CONFIDENCE.LOW,
                        raw: first.text,
                        coords: null,
                        needsGeocode: true
                    };
                }
            }
            
            if (allLocations.length >= 2) {
                const last = allLocations[allLocations.length - 1];
                if (last.resolved) {
                    dropoff = {
                        value: last.resolved.address,
                        displayValue: last.resolved.formal,
                        confidence: CONFIDENCE.HIGH,
                        coords: last.resolved.coords
                    };
                } else if (last.type === 'address') {
                    dropoff = extractLocation(last.text);
                } else {
                    // Place name - needs geocoding
                    dropoff = {
                        value: last.text,
                        displayValue: last.text,
                        confidence: CONFIDENCE.LOW,
                        raw: last.text,
                        coords: null,
                        needsGeocode: true
                    };
                }
            }
        }
        
        // Fallback: Try to extract business/place names if we don't have pickup/dropoff
        if (!pickup.value || pickup.confidence === CONFIDENCE.MISSING) {
            const potentialPickup = extractPotentialPlace(text, 'pickup');
            if (potentialPickup) {
                pickup = potentialPickup;
            }
        }
        
        if (!dropoff.value || dropoff.confidence === CONFIDENCE.MISSING) {
            const potentialDropoff = extractPotentialPlace(text, 'dropoff');
            if (potentialDropoff) {
                dropoff = potentialDropoff;
            }
        }
        
        // Check if phone matches a known client
        let client = null;
        if (phone.value) {
            client = matchClient(phone.value);
            if (client && !name.value) {
                name.value = client.name;
                name.confidence = CONFIDENCE.HIGH;
            }
        }
        
        return {
            phone,
            name,
            pickup,
            dropoff,
            stops,
            time,
            specialNotes,
            client,
            rawText: text
        };
    }
    
    // ============================================================================
    // UI UPDATE FUNCTIONS
    // ============================================================================
    
    /**
     * Get confidence indicator HTML
     */
    function getConfidenceIndicator(confidence) {
        switch(confidence) {
            case CONFIDENCE.HIGH:
                return '<span class="confidence-indicator confidence-high" title="High confidence">[GREEN]</span>';
            case CONFIDENCE.LOW:
                return '<span class="confidence-indicator confidence-low" title="Needs verification">[YELLOW]</span>';
            case CONFIDENCE.MISSING:
            default:
                return '<span class="confidence-indicator confidence-missing" title="Not detected">[RED]</span>';
        }
    }
    
    /**
     * Update Call Summary widget with parsed data
     * @param {Object} parsed - Parsed data from parse()
     */
    function updateCallSummary(parsed) {
        // Phone
        const phoneInput = document.getElementById('dispatch-phone');
        const phoneSummary = document.getElementById('summary-phone');
        if (phoneInput && parsed.phone.value) {
            phoneInput.value = parsed.phone.value;
            if (parsed.phone.confidence === CONFIDENCE.LOW) {
                phoneInput.classList.add('needs-verification');
            } else {
                phoneInput.classList.remove('needs-verification');
            }
        }
        if (phoneSummary) {
            phoneSummary.innerHTML = parsed.phone.value 
                ? `${parsed.phone.value} ${getConfidenceIndicator(parsed.phone.confidence)}`
                : `-- ${getConfidenceIndicator(CONFIDENCE.MISSING)}`;
        }
        
        // Name
        const nameInput = document.getElementById('dispatch-name');
        const nameSummary = document.getElementById('summary-name');
        if (nameInput && parsed.name.value) {
            nameInput.value = parsed.name.value;
            if (parsed.name.confidence === CONFIDENCE.LOW) {
                nameInput.classList.add('needs-verification');
            } else {
                nameInput.classList.remove('needs-verification');
            }
        }
        if (nameSummary) {
            nameSummary.innerHTML = parsed.name.value 
                ? `${parsed.name.value} ${getConfidenceIndicator(parsed.name.confidence)}`
                : `-- ${getConfidenceIndicator(CONFIDENCE.MISSING)}`;
        }
        
        // Pickup
        const pickupInput = document.getElementById('dispatch-pickup');
        const pickupSummary = document.getElementById('summary-pickup');
        if (pickupInput && parsed.pickup.value) {
            pickupInput.value = parsed.pickup.displayValue || parsed.pickup.value;
            if (parsed.pickup.coords) {
                pickupInput.dataset.lat = parsed.pickup.coords[1];
                pickupInput.dataset.lon = parsed.pickup.coords[0];
            }
            if (parsed.pickup.confidence === CONFIDENCE.LOW) {
                pickupInput.classList.add('needs-verification');
            } else {
                pickupInput.classList.remove('needs-verification');
            }
            
            // Trigger geocoding if we have an address but no coords
            const needsPickupGeocode = parsed.pickup.needsGeocode || 
                (parsed.pickup.value && !parsed.pickup.coords && typeof geocodeAddress === 'function');
            
            if (needsPickupGeocode) {
                // Guardrail: do not overwrite place names (e.g., "82 Lumber") with full Google-formatted addresses.
                // Only auto-geocode if it looks like a street address.
                const looksLikeStreetAddress = /\d/.test(parsed.pickup.value) && /(\b(st|street|ave|avenue|rd|road|dr|drive|blvd|boulevard|hwy|highway|cres|crescent|ct|court|pl|place|way|lane|ln)\b)/i.test(parsed.pickup.value);
                if (!looksLikeStreetAddress) {
                    console.log('[PARSE] Pre-Parser: Skipping auto-geocode for pickup place name:', parsed.pickup.value);
                } else {
                    console.log('[PARSE] Pre-Parser: Geocoding pickup:', parsed.pickup.value);
                    geocodeAddress(parsed.pickup.value).then(results => {
                        if (results && results.length > 0) {
                            const result = results[0];
                            // Keep the label in the input; store coords for map/ETA.
                            pickupInput.dataset.lat = result.lat;
                            pickupInput.dataset.lon = result.lon;
                            pickupInput.classList.remove('needs-verification');
                            if (pickupSummary) {
                                pickupSummary.innerHTML = `${parsed.pickup.displayValue || parsed.pickup.value} ${getConfidenceIndicator(CONFIDENCE.HIGH)}`;
                            }
                            console.log('[OK] Pre-Parser: Pickup geocoded (coords set):', result.displayName);
                            
                            // [TRIP] TRIGGER LIVE ETA CALCULATION
                            if (typeof calculateLivePickupETA === 'function') {
                                calculateLivePickupETA(
                                    parseFloat(result.lat),
                                    parseFloat(result.lon),
                                    parsed.pickup.displayValue || parsed.pickup.value
                                );
                            }
                        }
                    }).catch(err => console.warn('Geocode pickup failed:', err));
                }
            } else if (parsed.pickup.coords && parsed.pickup.coords.length >= 2) {
                // If pickup already has coords (from nickname match), trigger ETA immediately
                if (typeof calculateLivePickupETA === 'function') {
                    calculateLivePickupETA(
                        parsed.pickup.coords[1], // lat
                        parsed.pickup.coords[0], // lon
                        parsed.pickup.displayValue || parsed.pickup.value
                    );
                }
            }
        }
        if (pickupSummary) {
            pickupSummary.innerHTML = parsed.pickup.value 
                ? `${parsed.pickup.displayValue || parsed.pickup.value} ${getConfidenceIndicator(parsed.pickup.confidence)}`
                : `-- ${getConfidenceIndicator(CONFIDENCE.MISSING)}`;
        }
        
        // Dropoff
        const dropoffInput = document.getElementById('dispatch-dropoff');
        const dropoffSummary = document.getElementById('summary-dropoff');
        if (dropoffInput && parsed.dropoff.value) {
            dropoffInput.value = parsed.dropoff.displayValue || parsed.dropoff.value;
            if (parsed.dropoff.coords) {
                dropoffInput.dataset.lat = parsed.dropoff.coords[1];
                dropoffInput.dataset.lon = parsed.dropoff.coords[0];
            }
            if (parsed.dropoff.confidence === CONFIDENCE.LOW) {
                dropoffInput.classList.add('needs-verification');
            } else {
                dropoffInput.classList.remove('needs-verification');
            }
            
            // Trigger geocoding if we have an address but no coords
            const needsDropoffGeocode = parsed.dropoff.needsGeocode || 
                (parsed.dropoff.value && !parsed.dropoff.coords && typeof geocodeAddress === 'function');
            
            if (needsDropoffGeocode) {
                // Guardrail: do not overwrite place names with full Google-formatted addresses.
                const looksLikeStreetAddress = /\d/.test(parsed.dropoff.value) && /(\b(st|street|ave|avenue|rd|road|dr|drive|blvd|boulevard|hwy|highway|cres|crescent|ct|court|pl|place|way|lane|ln)\b)/i.test(parsed.dropoff.value);
                if (!looksLikeStreetAddress) {
                    console.log('[PARSE] Pre-Parser: Skipping auto-geocode for dropoff place name:', parsed.dropoff.value);
                } else {
                    console.log('[PARSE] Pre-Parser: Geocoding dropoff:', parsed.dropoff.value);
                    geocodeAddress(parsed.dropoff.value).then(results => {
                        if (results && results.length > 0) {
                            const result = results[0];
                            // Keep the label in the input; store coords for map/estimate.
                            dropoffInput.dataset.lat = result.lat;
                            dropoffInput.dataset.lon = result.lon;
                            dropoffInput.classList.remove('needs-verification');
                            if (dropoffSummary) {
                                dropoffSummary.innerHTML = `${parsed.dropoff.displayValue || parsed.dropoff.value} ${getConfidenceIndicator(CONFIDENCE.HIGH)}`;
                            }
                            console.log('[OK] Pre-Parser: Dropoff geocoded (coords set):', result.displayName);
                            
                            // Pre-parser ETA removed - user must click "Calculate Route" for accurate ETA
                        }
                    }).catch(err => console.warn('Geocode dropoff failed:', err));
                }
            } else if (parsed.dropoff.coords && parsed.dropoff.coords.length >= 2) {
                // Coords available but pre-parser ETA removed per user request
                // User must click "Calculate Route" for accurate ETA
            }
        }
        if (dropoffSummary) {
            dropoffSummary.innerHTML = parsed.dropoff.value 
                ? `${parsed.dropoff.displayValue || parsed.dropoff.value} ${getConfidenceIndicator(parsed.dropoff.confidence)}`
                : `-- ${getConfidenceIndicator(CONFIDENCE.MISSING)}`;
        }
        
        // Stops
        const stopsRow = document.getElementById('summary-stops-row');
        const stopsSummary = document.getElementById('summary-stops');
        if (parsed.stops.length > 0) {
            // Add waypoints to form (limit to 3 max)
            const maxWaypoints = 3;
            const stopsToProcess = parsed.stops.slice(0, maxWaypoints);
            
            stopsToProcess.forEach((stop, idx) => {
                if (typeof addWaypoint === 'function') {
                    // Check if waypoint already exists
                    const existingWaypoints = document.querySelectorAll('.waypoint-input');
                    if (existingWaypoints.length <= idx && existingWaypoints.length < maxWaypoints) {
                        addWaypoint();
                    }
                    // Populate waypoint - use correct ID pattern: waypoint-X-address
                    const waypointNum = idx + 1;
                    const waypointInput = document.getElementById('waypoint-' + waypointNum + '-address');
                    if (waypointInput) {
                        waypointInput.value = stop.displayValue || stop.value;
                        if (stop.coords) {
                            waypointInput.dataset.lat = stop.coords[1];
                            waypointInput.dataset.lon = stop.coords[0];
                        }
                        console.log('[OK] Pre-Parser: Populated waypoint ' + waypointNum + ':', stop.displayValue || stop.value);
                    } else {
                        console.warn('[WARN] Pre-Parser: Waypoint input not found for index ' + waypointNum);
                    }
                    // Set wait time if exists - use correct ID pattern: waypoint-X-wait
                    const waitDisplay = document.getElementById('waypoint-' + waypointNum + '-wait');
                    if (waitDisplay && stop.waitTime) {
                        waitDisplay.textContent = stop.waitTime + ' min';
                        waitDisplay.dataset.wait = stop.waitTime;
                    }
                }
            });
            
            // Update summary
            if (stopsRow) stopsRow.style.display = 'flex';
            if (stopsSummary) {
                const stopsText = parsed.stops.map((s, i) => {
                    const waitStr = s.waitTime ? ` (${s.waitTime}min)` : '';
                    return `${i + 1}. ${s.displayValue || s.value}${waitStr}`;
                }).join(' → ');
                stopsSummary.innerHTML = `${stopsText} ${getConfidenceIndicator(parsed.stops[0].confidence)}`;
            }
        } else {
            if (stopsRow) stopsRow.style.display = 'none';
        }
        
        // Time/Prebook
        const dateInput = document.getElementById('dispatch-prebook-date');
        const timeInput = document.getElementById('dispatch-prebook-time');
        const prebookSummary = document.getElementById('summary-prebook');
        if (parsed.time.isPrebook) {
            if (dateInput && parsed.time.date) dateInput.value = parsed.time.date;
            if (timeInput && parsed.time.time) timeInput.value = parsed.time.time;
            
            if (prebookSummary) {
                const dateStr = parsed.time.date ? new Date(parsed.time.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
                const timeStr = parsed.time.time ? parsed.time.time : '';
                prebookSummary.innerHTML = `${dateStr} ${timeStr} ${getConfidenceIndicator(parsed.time.confidence)}`;
            }
        } else {
            if (prebookSummary) {
                prebookSummary.innerHTML = `ASAP ${getConfidenceIndicator(CONFIDENCE.HIGH)}`;
            }
        }
        
        // Notes
        const notesInput = document.getElementById('dispatch-notes');
        const notesSummary = document.getElementById('summary-notes');
        if (parsed.specialNotes.notes.length > 0) {
            const notesText = parsed.specialNotes.notes.join(' | ');
            // Notes field: user enters manually (preparser doesn't fill it)
            if (notesSummary) {
                notesSummary.innerHTML = `${notesText} ${getConfidenceIndicator(CONFIDENCE.HIGH)}`;
            }
        } else {
            if (notesSummary) {
                const existingNotes = notesInput?.value.trim() || '';
                notesSummary.innerHTML = existingNotes 
                    ? `${existingNotes} ${getConfidenceIndicator(CONFIDENCE.HIGH)}`
                    : `-- ${getConfidenceIndicator(CONFIDENCE.MISSING)}`;
            }
        }
        
        // Trip Name stays empty (LLM will generate)
        const tripnameSummary = document.getElementById('summary-tripname');
        if (tripnameSummary) {
            tripnameSummary.innerHTML = `<span style="opacity: 0.5; font-style: italic;">Generated after processing</span>`;
        }
        
        console.log('[PARSE] Pre-Parser: Call Summary updated', parsed);
    }
    
    /**
     * Handle CLI input with debouncing
     */
    function handleCLIInput(text) {
        clearTimeout(parseDebounceTimer);
        parseDebounceTimer = setTimeout(() => {
            if (text.trim().length > 3) {
                const parsed = parse(text);
                updateCallSummary(parsed);
            }
        }, DEBOUNCE_MS);
    }
    
    /**
     * DISABLED: Pre-parser trip estimate removed per user request
     * Pre-parser ETAs conflicted with LLM/Google calculations
     * User must now click "Calculate Route" for accurate ETA
     */
    function tryCalculateTripEstimate() {
        // Function disabled - no pre-parser ETA
        return;
    }
    
    /**
     * Clear all form and summary fields
     */
    function clearAllFields() {
        // Clear form fields
        const fields = ['dispatch-phone', 'dispatch-name', 'dispatch-pickup', 'dispatch-dropoff', 
                        'dispatch-notes', 'dispatch-tripname', 'dispatch-llm-input'];
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.value = '';
                el.classList.remove('needs-verification');
                delete el.dataset.lat;
                delete el.dataset.lon;
            }
        });
        
        // Clear confidence indicators
        const indicators = ['summary-phone-confidence', 'summary-name-confidence', 
                            'summary-pickup-confidence', 'summary-dropoff-confidence'];
        indicators.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '';
        });
        
        // Reset date/time to now
        if (typeof initializeDispatchDateTime === 'function') {
            initializeDispatchDateTime();
        }
        
        // [TRIP] Clear live pickup ETA and return to generic global ETA
        if (typeof clearLivePickupETA === 'function') {
            clearLivePickupETA();
        }
        
        // [TRIP] Clear dispatch estimate box
        if (typeof clearDispatchEstimate === 'function') {
            clearDispatchEstimate();
        }
        
        console.log('🧹 Pre-Parser: Cleared all fields');
    }
    
    /**
     * DISABLED: Pre-Parser removed - LLM handles all parsing
     * Pre-parser regex produced incorrect results, LLM is 100% accurate
     */
    function init() {
        // Pre-parser disabled - no event listeners attached
        console.log('[OK] Pre-Parser DISABLED (LLM handles all parsing)');
    }
    
    // ============================================================================
    // GLOBAL EXPORTS
    // ============================================================================
    window.PreParser = {
        parse,
        updateCallSummary,
        handleCLIInput,
        clearAllFields,
        init,
        CONFIDENCE
    };
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM already loaded, init on next tick to ensure other kernels are ready
        setTimeout(init, 100);
    }
    
    console.log('[OK] kernel-preparser.js loaded');
    
})();
