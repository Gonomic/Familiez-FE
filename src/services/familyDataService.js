/**
 * Family Data Service
 * Handles all API calls to the middleware (MW) server
 */

import { getStoredToken, setAuthHeader, notifyAuthError, clearStoredToken } from "./authService";

const MW_BASE_URL = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

const buildAuthHeaders = () => {
    const token = getStoredToken();
    if (!token) {
        console.warn('[familyDataService] No auth token found in localStorage');
        return {};
    }
    const headers = setAuthHeader(token);
    console.debug('[familyDataService] Auth headers built, token length:', token.length);
    return headers;
};

const fetchWithAuth = (url, options = {}) => {
    const headers = {
        ...buildAuthHeaders(),
        ...(options.headers || {}),
    };
    const hasAuthHeader = 'Authorization' in headers;
    console.debug('[familyDataService] Request to:', url, 'Has Auth:', hasAuthHeader);
    return window.fetch(url, { ...options, headers });
};

// Use a local fetch wrapper that injects Authorization headers.
const fetch = fetchWithAuth;

export const getMwBaseUrl = () => MW_BASE_URL;
export const fetchWithAuthHeaders = fetchWithAuth;

/**
 * Get persons with names similar to the search string
 * @param {string} searchString - The string to search for
 * @returns {Promise<Array>} Array of matching persons
 */
export const getPersonsLike = async (searchString) => {
    if (!searchString) return [];
    try {
        const url = `${MW_BASE_URL}/GetPersonsLike?stringToSearchFor=${searchString}`;
        const response = await fetch(url);
        
        // Handle 401 Unauthorized (expired token)
        if (response.status === 401) {
            clearStoredToken();
            notifyAuthError("Uw sessie is verlopen. Meld u alstublieft opnieuw aan.");
            console.warn('Auth token expired, clearing and notifying user');
            return [];
        }
        
        // Check response status
        if (!response.ok) {
            console.error(`GetPersonsLike failed: ${response.status} ${response.statusText}`);
            return [];
        }
        
        const data = await response.json();
        
        // Validate data structure
        if (!Array.isArray(data) || !data[0]) {
            console.error('GetPersonsLike: Invalid response structure', data);
            return [];
        }
        
        if (data[0].numberOfRecords >= 1) {
            return data.slice(1);
        }
        return [];
    } catch (error) {
        console.error('Error getting persons like:', error);
        return [];
    }
};

/**
 * Get person details by ID
 * @param {number} personId - The ID of the person
 * @returns {Promise<Object|null>} Person details or null
 */
export const getPersonDetails = async (personId) => {
    try {
        const url = `${MW_BASE_URL}/GetPersonDetails?personID=${personId}`;
        const response = await fetch(url);
        
        // Handle 401 Unauthorized (expired token)
        if (response.status === 401) {
            clearStoredToken();
            notifyAuthError("Uw sessie is verlopen. Meld u alstublieft opnieuw aan.");
            return null;
        }
        
        if (!response.ok) {
            console.error(`GetPersonDetails failed: ${response.status} ${response.statusText}`);
            return null;
        }
        const data = await response.json();
        if (Array.isArray(data) && data[0] && data[0].numberOfRecords >= 1) {
            return data[1];
        }
        return null;
    } catch (error) {
        console.error('Error getting person details:', error);
        return null;
    }
};

/**
 * Get the father of a child
 * @param {number} childId - The ID of the child
 * @returns {Promise<number|null>} Father's ID or null
 */
export const getFather = async (childId) => {
    try {
        const url = `${MW_BASE_URL}/GetFather?childID=${childId}`;
        const response = await fetch(url);
        
        // Handle 401 Unauthorized (expired token)
        if (response.status === 401) {
            clearStoredToken();
            notifyAuthError("Uw sessie is verlopen. Meld u alstublieft opnieuw aan.");
            return null;
        }
        
        if (!response.ok) {
            console.error(`GetFather failed: ${response.status} ${response.statusText}`);
            return null;
        }
        const data = await response.json();
        if (Array.isArray(data) && data[0] && data[0].numberOfRecords >= 1) {
            return data[1].FatherId || data[1].FatherID;
        }
        return null;
    } catch (error) {
        console.error('Error getting father:', error);
        return null;
    }
};

/**
 * Get the mother of a child
 * @param {number} childId - The ID of the child
 * @returns {Promise<number|null>} Mother's ID or null
 */
export const getMother = async (childId) => {
    try {
        const url = `${MW_BASE_URL}/GetMother?childID=${childId}`;
        const response = await fetch(url);
        
        // Handle 401 Unauthorized (expired token)
        if (response.status === 401) {
            clearStoredToken();
            notifyAuthError("Uw sessie is verlopen. Meld u alstublieft opnieuw aan.");
            return null;
        }
        
        if (!response.ok) {
            console.error(`GetMother failed: ${response.status} ${response.statusText}`);
            return null;
        }
        const data = await response.json();
        if (Array.isArray(data) && data[0] && data[0].numberOfRecords >= 1) {
            return data[1].MotherId || data[1].MotherID;
        }
        return null;
    } catch (error) {
        console.error('Error getting mother:', error);
        return null;
    }
};

/**
 * Get siblings (children of the same parent)
 * @param {number} parentId - The ID of the parent
 * @returns {Promise<Array>} Array of siblings
 */
export const getSiblings = async (parentId) => {
    try {
        const url = `${MW_BASE_URL}/GetSiblings?parentID=${parentId}`;
        const response = await fetch(url);
        
        // Handle 401 Unauthorized (expired token)
        if (response.status === 401) {
            clearStoredToken();
            notifyAuthError("Uw sessie is verlopen. Meld u alstublieft opnieuw aan.");
            return [];
        }
        
        if (!response.ok) {
            console.error(`GetSiblings failed: ${response.status} ${response.statusText}`);
            return [];
        }
        const data = await response.json();
        if (Array.isArray(data) && data[0] && data[0].numberOfRecords >= 1) {
            return data.slice(1);
        }
        return [];
    } catch (error) {
        console.error('Error getting siblings:', error);
        return [];
    }
};

/**
 * Get partners of a person
 * @param {number} personId - The ID of the person
 * @returns {Promise<Array>} Array of partners
 */
export const getPartners = async (personId) => {
    try {
        const url = `${MW_BASE_URL}/GetPartners?personID=${personId}`;
        const response = await fetch(url);
        
        // Handle 401 Unauthorized (expired token)
        if (response.status === 401) {
            clearStoredToken();
            notifyAuthError("Uw sessie is verlopen. Meld u alstublieft opnieuw aan.");
            return [];
        }
        
        if (!response.ok) {
            console.error(`GetPartners failed: ${response.status} ${response.statusText}`);
            return [];
        }
        const data = await response.json();
        if (Array.isArray(data) && data[0] && data[0].numberOfRecords >= 1) {
            return data.slice(1);
        }
        return [];
    } catch (error) {
        console.error('Error getting partners:', error);
        return [];
    }
};

/**
 * Get children of a person
 * @param {number} personId - The ID of the person
 * @returns {Promise<Array>} Array of children
 */
export const getChildren = async (personId) => {
    try {
        const url = `${MW_BASE_URL}/GetChildren?personID=${personId}`;
        const response = await fetch(url);
        
        // Handle 401 Unauthorized (expired token)
        if (response.status === 401) {
            clearStoredToken();
            notifyAuthError("Uw sessie is verlopen. Meld u alstublieft opnieuw aan.");
            return [];
        }
        
        if (!response.ok) {
            console.error(`GetChildren failed: ${response.status} ${response.statusText}`);
            return [];
        }
        const data = await response.json();
        if (Array.isArray(data) && data[0] && data[0].numberOfRecords >= 1) {
            return data.slice(1);
        }
        return [];
    } catch (error) {
        console.error('Error getting children:', error);
        return [];
    }
};

/**
 * Get possible mothers based on a child's birth date
 * @param {string} personDateOfBirth - Birth date (YYYY-MM-DD)
 * @returns {Promise<Array>} Array of possible mothers
 */
export const getPossibleMothersBasedOnAge = async (personDateOfBirth) => {
    if (!personDateOfBirth) return [];
    try {
        const encodedDate = encodeURIComponent(personDateOfBirth);
        const url = `${MW_BASE_URL}/GetPossibleMothersBasedOnAge?personDateOfBirth=${encodedDate}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data[0].numberOfRecords >= 1) {
            return data.slice(1);
        }
        return [];
    } catch (error) {
        console.error('Error getting possible mothers based on age:', error);
        return [];
    }
};

/**
 * Get possible fathers based on a child's birth date
 * @param {string} personDateOfBirth - Birth date (YYYY-MM-DD)
 * @returns {Promise<Array>} Array of possible fathers
 */
export const getPossibleFathersBasedOnAge = async (personDateOfBirth) => {
    if (!personDateOfBirth) return [];
    try {
        const encodedDate = encodeURIComponent(personDateOfBirth);
        const url = `${MW_BASE_URL}/GetPossibleFathersBasedOnAge?personDateOfBirth=${encodedDate}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data[0].numberOfRecords >= 1) {
            return data.slice(1);
        }
        return [];
    } catch (error) {
        console.error('Error getting possible fathers based on age:', error);
        return [];
    }
};

/**
 * Get possible partners based on a person's birth date
 * @param {string} personDateOfBirth - Birth date (YYYY-MM-DD)
 * @returns {Promise<Array>} Array of possible partners
 */
export const getPossiblePartnersBasedOnAge = async (personDateOfBirth) => {
    if (!personDateOfBirth) return [];
    try {
        const encodedDate = encodeURIComponent(personDateOfBirth);
        const url = `${MW_BASE_URL}/GetPossiblePartnersBasedOnAge?personDateOfBirth=${encodedDate}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data[0].numberOfRecords >= 1) {
            return data.slice(1);
        }
        return [];
    } catch (error) {
        console.error('Error getting possible partners based on age:', error);
        return [];
    }
};

/**
 * Get releases for a component
 * @param {string} component - fe, mw, or be
 * @returns {Promise<Array>} Array of releases
 */
export const getReleases = async (component) => {
    if (!component) return [];
    try {
        const url = `${MW_BASE_URL}/GetReleases?component=${component}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load releases: ${response.status}`);
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error('Error getting releases:', error);
        throw error;
    }
};

/**
 * Update person details
 * @param {number} personId - The ID of the person
 * @param {Object} personData - The updated person data
 * @returns {Promise<boolean>} Success status
 */
export const updatePerson = async (personId, personData) => {
    try {
        const url = `${MW_BASE_URL}/UpdatePerson`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ personId, ...personData }),
        });
        const data = await response.json();
        return data.success || false;
    } catch (error) {
        console.error('Error updating person:', error);
        return false;
    }
};
/**
 * Delete a person and all their relationships
 * @param {Object} person - The person object with ID and Timestamp
 * @returns {Promise<boolean>} Success status
 */
export const deletePerson = async (person) => {
    try {
        const url = `${MW_BASE_URL}/DeletePerson`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                personId: person.PersonID,
                Timestamp: person.Timestamp,
                MotherId: person.MotherId || null,
                FatherId: person.FatherId || null,
                PartnerId: person.PartnerId || null
            }),
        });
        const data = await response.json();
        return data.success || false;
    } catch (error) {
        console.error('Error deleting person:', error);
        return false;
    }
};

/**
 * Add a new person
 * @param {Object} personData - The person data
 * @returns {Promise<Object|null>} New person data with ID or null if failed
 */
export const addPerson = async (personData) => {
    try {
        const url = `${MW_BASE_URL}/AddPerson`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(personData),
        });
        const data = await response.json();
        if (data.success && data.personId) {
            return { success: true, person: { ...personData, PersonID: data.personId } };
        }

        console.error('AddPerson failed:', data.error || 'Unknown error');
        return { success: false, error: data.error || 'Toevoegen mislukt.' };
    } catch (error) {
        console.error('Error adding person:', error);
        return { success: false, error: 'Toevoegen mislukt door een netwerkfout.' };
    }
};