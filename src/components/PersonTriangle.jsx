import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * PersonTriangle Component
 * Renders a person as a draggable triangle (two points up, one point down)
 * Shows name, first name, and birth date
 */
const PersonTriangle = ({ 
    person, 
    x, 
    y, 
    width = 120, 
    height = 100,
    onDragStart,
    onDrag,
    onDragEnd,
    onClick,
    partners = [],
    isPartnerDragging = false,
    isRootPerson = false,
    isSelected = false
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const triangleRef = useRef(null);

    // Calculate triangle points (two points up, one down)
    const points = `${x},${y + height} ${x - width/2},${y} ${x + width/2},${y}`;

    const handleMouseDown = (e) => {
        if (e.button !== 0) return; // Only left click
        e.stopPropagation();
        
        const svg = triangleRef.current.ownerSVGElement;
        const CTM = svg.getScreenCTM();
        const point = svg.createSVGPoint();
        point.x = e.clientX;
        point.y = e.clientY;
        const svgPoint = point.matrixTransform(CTM.inverse());
        
        setDragOffset({
            x: svgPoint.x - x,
            y: svgPoint.y - y
        });
        setIsDragging(true);
        
        if (onDragStart) {
            onDragStart(person.PersonID);
        }
    };

    useEffect(() => {
        if (!isDragging && !isPartnerDragging) return;

        const handleMouseMove = (e) => {
            if (!triangleRef.current) return;
            
            const svg = triangleRef.current.ownerSVGElement;
            const CTM = svg.getScreenCTM();
            const point = svg.createSVGPoint();
            point.x = e.clientX;
            point.y = e.clientY;
            const svgPoint = point.matrixTransform(CTM.inverse());

            const newX = svgPoint.x - dragOffset.x;
            const newY = svgPoint.y - dragOffset.y;

            if (onDrag) {
                onDrag(person.PersonID, newX, newY);
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            if (onDragEnd) {
                onDragEnd(person.PersonID);
            }
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isPartnerDragging, dragOffset, x, y, person.PersonID, onDrag, onDragEnd]);

    const handleClick = (e) => {
        if (isDragging) return;
        e.stopPropagation();
        if (onClick) {
            onClick(person, e.clientX, e.clientY);
        }
    };

    // Format the text to fit in triangle
    const formatText = (text, maxLength = 15) => {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    };
    
    // Calculate age
    const calculateAge = () => {
        if (!person.PersonDateOfBirth) return null;
        
        const birthDate = new Date(person.PersonDateOfBirth);
        const endDate = person.PersonDateOfDeath ? new Date(person.PersonDateOfDeath) : new Date();
        
        let age = endDate.getFullYear() - birthDate.getFullYear();
        const monthDiff = endDate.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && endDate.getDate() < birthDate.getDate())) {
            age--;
        }
        
        return age >= 0 ? age : null;
    };

    const fullName = `${person.PersonGivvenName || ''} ${person.PersonFamilyName || ''}`.trim();
    const birthDate = person.PersonDateOfBirth || '';
    const deathDate = person.PersonDateOfDeath || '';
    const age = calculateAge();
    
    // Determine gender color (blue for male, pink for female)
    const genderColor = person.PersonIsMale ? '#2196F3' : '#E91E63';
    
    // Calculate points for bottom 20% colored triangle
    const bottomTrianglePoints = `${x},${y + height} ${x - width/2 * 0.2},${y + height * 0.8} ${x + width/2 * 0.2},${y + height * 0.8}`;
    
    // Calculate points for top-left small triangle (blue) - inside the main triangle, half the size (10%)
    // Triangle starts at top-left corner and goes along the left and top sides
    const topLeftTrianglePoints = `${x - width/2},${y} ${x - width/2 + width * 0.1},${y} ${x - width/2 + width * 0.05},${y + height * 0.1}`;
    
    // Calculate points for top-right small triangle (pink) - inside the main triangle, half the size (10%)
    // Triangle starts at top-right corner and goes along the right and top sides
    const topRightTrianglePoints = `${x + width/2},${y} ${x + width/2 - width * 0.05},${y + height * 0.1} ${x + width/2 - width * 0.1},${y}`;

    return (
        <g ref={triangleRef}>
            {/* Main triangle shape */}
            <polygon
                points={points}
                fill={isSelected ? "#E0E0E0" : (isRootPerson ? "#FFEB3B" : "white")}
                stroke="#1976d2"
                strokeWidth="2"
                style={{
                    cursor: isDragging ? 'grabbing' : 'grab',
                    filter: isDragging ? 'drop-shadow(0 0 5px rgba(0,0,0,0.3))' : 'none'
                }}
                onMouseDown={handleMouseDown}
                onClick={handleClick}
            />
            {/* Gender indicator - colored bottom point (20% of height) */}
            <polygon
                points={bottomTrianglePoints}
                fill={genderColor}
                pointerEvents="none"
            />
            {/* Small blue triangle at top-left corner */}
            <polygon
                points={topLeftTrianglePoints}
                fill="#2196F3"
                pointerEvents="none"
            />
            {/* Small pink triangle at top-right corner */}
            <polygon
                points={topRightTrianglePoints}
                fill="#E91E63"
                pointerEvents="none"
            />
            {/* Person's name - positioned near top, afgekapt */}
            <text
                x={x}
                y={y + 22}
                textAnchor="middle"
                fill="#1976d2"
                fontSize="14"
                fontFamily="Verdana, sans-serif"
                fontWeight="bold"
                pointerEvents="none"
            >
                {formatText(fullName, 18)}
            </text>
            {/* Birth date - positioned onder naam */}
            <text
                x={x}
                y={y + 40}
                textAnchor="middle"
                fill="#666"
                fontSize="11"
                fontFamily="Verdana, sans-serif"
                pointerEvents="none"
            >
                {formatText(birthDate, 14)}
            </text>
            {/* Death date - positioned onder geboortedatum (indien aanwezig) */}
            {deathDate && (
                <text
                    x={x}
                    y={y + 58}
                    textAnchor="middle"
                    fill="#666"
                    fontSize="11"
                    fontFamily="Verdana, sans-serif"
                    pointerEvents="none"
                >
                    {formatText(deathDate, 14)}
                </text>
            )}
            {/* Age - positioned onder death date of birth date */}
            {age !== null && (
                <text
                    x={x}
                    y={deathDate ? y + 76 : y + 58}
                    textAnchor="middle"
                    fill="#999"
                    fontSize="11"
                    fontFamily="Verdana, sans-serif"
                    fontStyle="italic"
                    pointerEvents="none"
                >
                    {age} jaar
                </text>
            )}
            {/* Fotozone als cirkel onderin driehoek */}
            {person.photoUrl && (
                    <circle
                        cx={x}
                        cy={y + height - 48}
                        r={24}
                        fill={`url(#personPhotoPattern_${person.PersonID})`}
                        stroke="#1976d2"
                        strokeWidth="1"
                    />
            )}
            {/* SVG pattern voor foto (indien aanwezig) */}
            {person.photoUrl && (
                <defs>
                    <pattern id={"personPhotoPattern_" + person.PersonID} patternUnits="userSpaceOnUse" width={48} height={48}>
                        <image href={person.photoUrl} x="0" y="0" width={48} height={48} preserveAspectRatio="xMidYMid slice" />
                    </pattern>
                </defs>
            )}
        </g>
    );
};

PersonTriangle.propTypes = {
    person: PropTypes.shape({
        PersonID: PropTypes.number.isRequired,
        PersonGivvenName: PropTypes.string,
        PersonFamilyName: PropTypes.string,
        PersonDateOfBirth: PropTypes.string,
        PersonDateOfDeath: PropTypes.string,
        PersonIsMale: PropTypes.bool,
    }).isRequired,
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    width: PropTypes.number,
    height: PropTypes.number,
    onDragStart: PropTypes.func,
    onDrag: PropTypes.func,
    onDragEnd: PropTypes.func,
    onClick: PropTypes.func,
    partners: PropTypes.array,
    isPartnerDragging: PropTypes.bool,
    isRootPerson: PropTypes.bool,
    isSelected: PropTypes.bool,
};

export default PersonTriangle;
