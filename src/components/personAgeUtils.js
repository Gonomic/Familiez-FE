const hasNonEmptyValue = (value) => {
    if (value === null || value === undefined) {
        return false;
    }
    return String(value).trim() !== '';
};

const parseDate = (value) => {
    if (!hasNonEmptyValue(value)) {
        return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const isMarkedDeceased = (person = {}) => {
    const hasDeathDate = hasNonEmptyValue(person.PersonDateOfDeath);
    const hasDeathPlace = hasNonEmptyValue(person.PersonPlaceOfDeath);

    // Support existing and future backend flags if they are present.
    const deceasedFlag = person.PersonIsDeceased === true
        || person.PersonIsDeceased === 1
        || person.PersonIsDead === true
        || person.PersonIsDead === 1
        || person.PersonIsAlive === false
        || person.PersonIsAlive === 0;

    return hasDeathDate || hasDeathPlace || deceasedFlag;
};

export const calculateDisplayAge = (person = {}, now = new Date()) => {
    const birthDate = parseDate(person.PersonDateOfBirth);
    if (!birthDate) {
        return null;
    }

    const deathDate = parseDate(person.PersonDateOfDeath);
    const deceasedWithoutDeathDate = isMarkedDeceased(person) && !deathDate;

    // WG-03: deceased but unknown death date should not show age.
    if (deceasedWithoutDeathDate) {
        return null;
    }

    const endDate = deathDate || now;

    let age = endDate.getFullYear() - birthDate.getFullYear();
    const monthDiff = endDate.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && endDate.getDate() < birthDate.getDate())) {
        age -= 1;
    }

    return age >= 0 ? age : null;
};
