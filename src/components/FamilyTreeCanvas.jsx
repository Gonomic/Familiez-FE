import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import PersonTriangle from './PersonTriangle';
import PersonContextMenu from './PersonContextMenu';
import { getPersonDetails, getFather, getMother, getChildren, getPartners } from '../services/familyDataService';

/**
 * FamilyTreeCanvas Component
 * Main component for rendering the family tree with SVG
 */
const FamilyTreeCanvas = ({ 
    rootPerson, 
    nbrOfParentGenerations = 1, 
    nbrOfChildGenerations = 1,
    treeRefreshTrigger = 0,
    lastAddedParentId = null,
    onEditPerson,
    onDeletePerson,
    onAddPerson
}) => {
    const [familyData, setFamilyData] = useState(new Map()); // Map of PersonID -> person data
    const [positions, setPositions] = useState(new Map()); // Map of PersonID -> {x, y}
    const [parentsMap, setParentsMap] = useState(new Map()); // childID -> {fatherId, motherId}
    const [partnersMap, setPartnersMap] = useState(new Map()); // personID -> [partnerIDs]
    const [childrenMap, setChildrenMap] = useState(new Map()); // parentID -> [childIDs]
    const [siblingsMap, setSiblingsMap] = useState(new Map()); // rootPersonID -> [siblingIDs sorted by age]
    const [canvasSize, setCanvasSize] = useState({ width: 2000, height: 2000 }); // Dynamic canvas size
    const [contextMenu, setContextMenu] = useState(null);
    const [selectedPerson, setSelectedPerson] = useState(null);
    const [draggingPersonId, setDraggingPersonId] = useState(null);

    // Layout constants
    const TRIANGLE_WIDTH = 120;
    const TRIANGLE_HEIGHT = 100;
    const HORIZONTAL_GAP = 160;
    const VERTICAL_GAP = 300;

    /**
     * Build the family tree data structure
     */
    const buildFamilyTree = useCallback(async () => {
        if (!rootPerson) {
            // Clear all state when no root person is selected
            setFamilyData(new Map());
            setPositions(new Map());
            setParentsMap(new Map());
            setPartnersMap(new Map());
            setChildrenMap(new Map());
            setSiblingsMap(new Map());
            setCanvasSize({ width: 2000, height: 2000 });
            return;
        }

        // Clear existing state before building new tree
        setFamilyData(new Map());
        setPositions(new Map());
        setParentsMap(new Map());
        setPartnersMap(new Map());
        setChildrenMap(new Map());
        setSiblingsMap(new Map());

        console.log('=== Building Family Tree ===');
        console.log('Root Person:', rootPerson);
        console.log('Parent Generations:', nbrOfParentGenerations);
        console.log('Child Generations:', nbrOfChildGenerations);

        const newFamilyData = new Map();
        const newPositions = new Map();
        const newParentsMap = new Map();
        const newPartnersMap = new Map();
        const newChildrenMap = new Map();
        const newSiblingsMap = new Map();
        const partnerLookupCache = new Map();

        const arePartners = async (personId, partnerId) => {
            if (!personId || !partnerId) return false;
            if (!partnerLookupCache.has(personId)) {
                const partners = await getPartners(personId);
                partnerLookupCache.set(
                    personId,
                    new Set((partners || []).map(partner => partner.PersonID))
                );
            }
            return partnerLookupCache.get(personId).has(partnerId);
        };

        // Helper to add person to data
        const addPerson = async (personId, generation) => {
            if (!personId || newFamilyData.has(personId)) return null;
            
            console.log(`Fetching person details for ID: ${personId}, generation: ${generation}`);
            const personData = await getPersonDetails(personId);
            if (!personData) {
                console.log(`No data found for person ID: ${personId}`);
                return null;
            }
            
            console.log(`Added person:`, personData);
            newFamilyData.set(personId, { ...personData, generation });
            return personData;
        };

        // Start with root person
        await addPerson(rootPerson.PersonID, 0);
        
        // Get siblings of root person
        const rootFatherId = await getFather(rootPerson.PersonID);
        const rootMotherId = await getMother(rootPerson.PersonID);
        
        if (rootFatherId || rootMotherId) {
            console.log('=== Getting siblings of root person ===');
            const allSiblings = [];
            
            // Get children from father (if exists)
            if (rootFatherId) {
                const fatherChildren = await getChildren(rootFatherId);
                if (fatherChildren) {
                    allSiblings.push(...fatherChildren);
                }
            }
            
            // Get children from mother (if exists) - avoid duplicates
            if (rootMotherId) {
                const motherChildren = await getChildren(rootMotherId);
                if (motherChildren) {
                    motherChildren.forEach(child => {
                        if (!allSiblings.find(s => s.PersonID === child.PersonID)) {
                            allSiblings.push(child);
                        }
                    });
                }
            }
            
            // Filter out root person and sort by birth date
            const siblings = allSiblings
                .filter(s => s.PersonID !== rootPerson.PersonID)
                .sort((a, b) => {
                    const dateA = new Date(a.PersonDateOfBirth || '9999-12-31');
                    const dateB = new Date(b.PersonDateOfBirth || '9999-12-31');
                    return dateA - dateB; // Oldest first
                });
            
            console.log('Found siblings:', siblings.length);
            
            // Add siblings to family data
            for (const sibling of siblings) {
                await addPerson(sibling.PersonID, 0); // Same generation as root
                
                // Set parent relationship for sibling
                newParentsMap.set(sibling.PersonID, {
                    fatherId: rootFatherId || null,
                    motherId: rootMotherId || null
                });
                
                // Get partners of sibling
                const siblingPartners = await getPartners(sibling.PersonID);
                if (siblingPartners && siblingPartners.length > 0) {
                    for (const partner of siblingPartners) {
                        await addPerson(partner.PersonID, 0); // Same generation
                        
                        // Set partner relationship
                        if (!newPartnersMap.has(sibling.PersonID)) {
                            newPartnersMap.set(sibling.PersonID, []);
                        }
                        if (!newPartnersMap.get(sibling.PersonID).includes(partner.PersonID)) {
                            newPartnersMap.get(sibling.PersonID).push(partner.PersonID);
                        }
                        
                        if (!newPartnersMap.has(partner.PersonID)) {
                            newPartnersMap.set(partner.PersonID, []);
                        }
                        if (!newPartnersMap.get(partner.PersonID).includes(sibling.PersonID)) {
                            newPartnersMap.get(partner.PersonID).push(sibling.PersonID);
                        }
                        
                        console.log(`Added partner ${partner.PersonID} for sibling ${sibling.PersonID}`);
                    }
                }
            }
            
            // Store siblings list
            if (siblings.length > 0) {
                newSiblingsMap.set(rootPerson.PersonID, siblings.map(s => s.PersonID));
            }
        }
        
        // Build upward (parents)
        const buildUpward = async (personId, currentGen) => {
            if (currentGen >= nbrOfParentGenerations) return;
            
            console.log(`Building upward from person ${personId}, generation ${currentGen}`);
            const fatherId = await getFather(personId);
            const motherId = await getMother(personId);
            
            console.log(`Father: ${fatherId}, Mother: ${motherId} for child ${personId}`);
            
            if (fatherId || motherId) {
                newParentsMap.set(personId, { 
                    fatherId: fatherId || null, 
                    motherId: motherId || null 
                });
                console.log(`Set parent relationship for child ${personId}:`, newParentsMap.get(personId));
                
                if (fatherId) {
                    await addPerson(fatherId, currentGen + 1);
                    await buildUpward(fatherId, currentGen + 1);
                }
                
                if (motherId) {
                    await addPerson(motherId, currentGen + 1);
                    await buildUpward(motherId, currentGen + 1);
                }
                
                // Only set partners when DB confirms the relationship
                if (fatherId && motherId && await arePartners(fatherId, motherId)) {
                    if (!newPartnersMap.has(fatherId)) {
                        newPartnersMap.set(fatherId, []);
                    }
                    if (!newPartnersMap.get(fatherId).includes(motherId)) {
                        newPartnersMap.get(fatherId).push(motherId);
                    }
                    
                    if (!newPartnersMap.has(motherId)) {
                        newPartnersMap.set(motherId, []);
                    }
                    if (!newPartnersMap.get(motherId).includes(fatherId)) {
                        newPartnersMap.get(motherId).push(fatherId);
                    }
                    console.log(`Set partner relationship between ${fatherId} and ${motherId}`);
                }
            }
        };

        // Build downward (children)
        const buildDownward = async (personId, depth) => {
            if (depth >= nbrOfChildGenerations) return;
            
            const childrenData = await getChildren(personId);
            
            if (childrenData && childrenData.length > 0) {
                const childIds = childrenData.map(child => child.PersonID);
                newChildrenMap.set(personId, childIds);
                
                for (const child of childrenData) {
                    const childGeneration = -(depth + 1);
                    await addPerson(child.PersonID, childGeneration);
                    
                    // Get the father and mother of this child to establish proper parent relationships
                    const childFatherId = await getFather(child.PersonID);
                    const childMotherId = await getMother(child.PersonID);
                    
                    console.log(`Child ${child.PersonID} has father ${childFatherId} and mother ${childMotherId}`);
                    
                    // Set parent relationship for this child
                    newParentsMap.set(child.PersonID, {
                        fatherId: childFatherId || null,
                        motherId: childMotherId || null
                    });
                    
                    // If we haven't added the parents yet, add them
                    if (childFatherId && !newFamilyData.has(childFatherId)) {
                        await addPerson(childFatherId, -depth);
                    }
                    if (childMotherId && !newFamilyData.has(childMotherId)) {
                        await addPerson(childMotherId, -depth);
                    }
                    
                    // Only set partners when DB confirms the relationship
                    if (childFatherId && childMotherId && await arePartners(childFatherId, childMotherId)) {
                        if (!newPartnersMap.has(childFatherId)) {
                            newPartnersMap.set(childFatherId, []);
                        }
                        if (!newPartnersMap.get(childFatherId).includes(childMotherId)) {
                            newPartnersMap.get(childFatherId).push(childMotherId);
                        }
                        
                        if (!newPartnersMap.has(childMotherId)) {
                            newPartnersMap.set(childMotherId, []);
                        }
                        if (!newPartnersMap.get(childMotherId).includes(childFatherId)) {
                            newPartnersMap.get(childMotherId).push(childFatherId);
                        }
                        console.log(`Set partner relationship between ${childFatherId} and ${childMotherId}`);
                    }
                    
                    await buildDownward(child.PersonID, depth + 1);
                }
            }
        };

        const includeChildrenForParent = async (parentId) => {
            const parentData = newFamilyData.get(parentId);
            if (!parentData) return;

            const childrenData = await getChildren(parentId);
            if (!childrenData || childrenData.length === 0) return;

            const childIds = childrenData.map(child => child.PersonID);
            newChildrenMap.set(parentId, childIds);

            for (const child of childrenData) {
                const childGeneration = parentData.generation - 1;
                await addPerson(child.PersonID, childGeneration);

                const childFatherId = await getFather(child.PersonID);
                const childMotherId = await getMother(child.PersonID);

                newParentsMap.set(child.PersonID, {
                    fatherId: childFatherId || null,
                    motherId: childMotherId || null
                });

                if (childFatherId && !newFamilyData.has(childFatherId)) {
                    await addPerson(childFatherId, childGeneration + 1);
                }
                if (childMotherId && !newFamilyData.has(childMotherId)) {
                    await addPerson(childMotherId, childGeneration + 1);
                }

                if (childFatherId && childMotherId && await arePartners(childFatherId, childMotherId)) {
                    if (!newPartnersMap.has(childFatherId)) {
                        newPartnersMap.set(childFatherId, []);
                    }
                    if (!newPartnersMap.get(childFatherId).includes(childMotherId)) {
                        newPartnersMap.get(childFatherId).push(childMotherId);
                    }

                    if (!newPartnersMap.has(childMotherId)) {
                        newPartnersMap.set(childMotherId, []);
                    }
                    if (!newPartnersMap.get(childMotherId).includes(childFatherId)) {
                        newPartnersMap.get(childMotherId).push(childFatherId);
                    }
                }
            }
        };

        // Build the tree
        await buildUpward(rootPerson.PersonID, 0);
        await buildDownward(rootPerson.PersonID, 0);

        if (lastAddedParentId && newFamilyData.has(lastAddedParentId)) {
            await includeChildrenForParent(lastAddedParentId);
        }

        console.log('Family data collected:', newFamilyData.size, 'persons');
        console.log('Relationships parents:', Array.from(newParentsMap.entries()));
        console.log('Relationships partners:', Array.from(newPartnersMap.entries()));

        // Calculate positions and canvas size
        const canvasDimensions = calculatePositions(newFamilyData, newParentsMap, newPartnersMap, newSiblingsMap, rootPerson.PersonID, newPositions);

        console.log('Positions calculated:', newPositions.size, 'positions');
        console.log('=== Family Tree Built Successfully ===');

        setFamilyData(newFamilyData);
        setParentsMap(newParentsMap);
        setPartnersMap(newPartnersMap);
        setChildrenMap(newChildrenMap);
        setSiblingsMap(newSiblingsMap);
        setPositions(newPositions);
        setCanvasSize(canvasDimensions);
    }, [rootPerson, nbrOfParentGenerations, nbrOfChildGenerations, treeRefreshTrigger, lastAddedParentId]);

    /**
     * Calculate positions for all persons
     */
    const calculatePositions = (familyData, parentsMap, partnersMap, siblingsMap, rootPersonId, positions) => {
        const centerX = 500;
        
        // Helper function to position a couple with man on the left
        const positionCouple = (personId, partnerId, x, y, positions, positioned) => {
            const person = familyData.get(personId);
            const partner = familyData.get(partnerId);
            
            // Determine who goes left (man) and who goes right (woman)
            let leftPerson, rightPerson;
            
            if (person?.PersonIsMale && !partner?.PersonIsMale) {
                // Person is male, partner is female -> person left
                leftPerson = personId;
                rightPerson = partnerId;
            } else if (!person?.PersonIsMale && partner?.PersonIsMale) {
                // Person is female, partner is male -> partner left
                leftPerson = partnerId;
                rightPerson = personId;
            } else {
                // Same gender or unknown -> keep original order
                leftPerson = personId;
                rightPerson = partnerId;
            }
            
            positions.set(leftPerson, { x: x, y });
            positions.set(rightPerson, { x: x + TRIANGLE_WIDTH, y });
            positioned.add(personId);
            positioned.add(partnerId);
        };
        
        // Group persons by generation
        const generations = new Map();
        familyData.forEach((person, personId) => {
            const gen = person.generation;
            if (!generations.has(gen)) {
                generations.set(gen, []);
            }
            generations.get(gen).push(personId);
        });
        
        // Calculate centerY dynamically based on the highest generation
        // This ensures all generations fit on the canvas
        const maxGeneration = Math.max(...generations.keys());
        const minGeneration = Math.min(...generations.keys());
        const TOP_MARGIN = 200; // Minimum space from top of canvas
        
        // Position centerY so that the highest generation has TOP_MARGIN from top
        const centerY = TOP_MARGIN + (maxGeneration * VERTICAL_GAP);
        
        console.log(`Positioning: maxGen=${maxGeneration}, minGen=${minGeneration}, centerY=${centerY}`);

        // Position each generation
        const sortedGenerations = Array.from(generations.keys()).sort((a, b) => b - a);
        
        sortedGenerations.forEach((gen, genIndex) => {
            const personsInGen = generations.get(gen);
            const y = centerY - (gen * VERTICAL_GAP);
            
            // Special handling for generation 0 (root person with siblings)
            if (gen === 0 && siblingsMap.has(rootPersonId)) {
                console.log('=== Positioning generation 0 with siblings ===');
                const positioned = new Set();
                const siblingIds = siblingsMap.get(rootPersonId);
                
                // Get birth date of root person for comparison
                const rootBirthDate = new Date(familyData.get(rootPersonId)?.PersonDateOfBirth || '9999-12-31');
                
                // Split siblings into younger (left) and older (right)
                const youngerSiblings = [];
                const olderSiblings = [];
                
                siblingIds.forEach(sibId => {
                    const sibBirthDate = new Date(familyData.get(sibId)?.PersonDateOfBirth || '9999-12-31');
                    if (sibBirthDate < rootBirthDate) {
                        olderSiblings.push(sibId); // Born earlier = older
                    } else {
                        youngerSiblings.push(sibId);
                    }
                });
                
                console.log('Younger siblings:', youngerSiblings);
                console.log('Older siblings:', olderSiblings);
                
                // Position root person in center
                let currentX = centerX;
                
                // Position root person and their partner (if any)
                const rootPartners = partnersMap.get(rootPersonId) || [];
                const rootPartnerInGen = rootPartners.find(partnerId => 
                    generations.get(gen)?.includes(partnerId)
                );
                
                if (rootPartnerInGen) {
                    positionCouple(rootPersonId, rootPartnerInGen, currentX, y, positions, positioned);
                } else {
                    positions.set(rootPersonId, { x: currentX, y });
                    positioned.add(rootPersonId);
                }
                
                // Position older siblings to the right
                currentX = centerX + (rootPartnerInGen ? TRIANGLE_WIDTH * 2 + HORIZONTAL_GAP : HORIZONTAL_GAP);
                olderSiblings.forEach(sibId => {
                    if (positioned.has(sibId)) return;
                    
                    const partners = partnersMap.get(sibId) || [];
                    const partnerInGen = partners.find(partnerId => 
                        generations.get(gen)?.includes(partnerId)
                    );
                    
                    if (partnerInGen && !positioned.has(partnerInGen)) {
                        positionCouple(sibId, partnerInGen, currentX, y, positions, positioned);
                        currentX += (TRIANGLE_WIDTH * 2) + HORIZONTAL_GAP;
                    } else if (!positioned.has(sibId)) {
                        positions.set(sibId, { x: currentX, y });
                        positioned.add(sibId);
                        currentX += HORIZONTAL_GAP;
                    }
                });
                
                // Position younger siblings to the left (reverse order)
                currentX = centerX - HORIZONTAL_GAP;
                youngerSiblings.reverse().forEach(sibId => {
                    if (positioned.has(sibId)) return;
                    
                    const partners = partnersMap.get(sibId) || [];
                    const partnerInGen = partners.find(partnerId => 
                        generations.get(gen)?.includes(partnerId)
                    );
                    
                    if (partnerInGen && !positioned.has(partnerInGen)) {
                        positionCouple(sibId, partnerInGen, currentX - TRIANGLE_WIDTH, y, positions, positioned);
                        currentX -= (TRIANGLE_WIDTH * 2) + HORIZONTAL_GAP;
                    } else if (!positioned.has(sibId)) {
                        positions.set(sibId, { x: currentX, y });
                        positioned.add(sibId);
                        currentX -= HORIZONTAL_GAP;
                    }
                });
                
                return; // Skip default positioning for this generation
            }
            
            // Default positioning for other generations
            const positioned = new Set();
            let currentX = centerX - ((personsInGen.length - 1) * HORIZONTAL_GAP) / 2;
            
            personsInGen.forEach((personId) => {
                if (positioned.has(personId)) return;
                
                // Check if this person has a partner in the same generation
                const partners = partnersMap.get(personId) || [];
                const partnerInGen = partners.find(partnerId => 
                    generations.get(gen)?.includes(partnerId)
                );
                
                if (partnerInGen && !positioned.has(partnerInGen)) {
                    // Position as couple - man on the left
                    positionCouple(personId, partnerInGen, currentX, y, positions, positioned);
                    // Verhoog currentX met breedte van beide driehoeken plus gap naar volgende persoon
                    currentX += (TRIANGLE_WIDTH * 2) + HORIZONTAL_GAP;
                } else if (!positioned.has(personId)) {
                    // Position alone
                    positions.set(personId, { x: currentX, y });
                    positioned.add(personId);
                    currentX += HORIZONTAL_GAP;
                }
            });
        });
        
        // Calculate required canvas dimensions
        let maxX = 0;
        let maxY = 0;
        let minX = Infinity;
        let minY = Infinity;
        
        positions.forEach(pos => {
            maxX = Math.max(maxX, pos.x + TRIANGLE_WIDTH / 2);
            maxY = Math.max(maxY, pos.y + TRIANGLE_HEIGHT);
            minX = Math.min(minX, pos.x - TRIANGLE_WIDTH / 2);
            minY = Math.min(minY, pos.y);
        });
        
        const CANVAS_PADDING = 200; // Extra padding around the tree
        const canvasWidth = Math.max(2000, maxX - minX + CANVAS_PADDING * 2);
        const canvasHeight = Math.max(2000, maxY - minY + CANVAS_PADDING * 2);
        
        console.log(`Canvas dimensions: ${canvasWidth}x${canvasHeight}`);
        
        return { width: canvasWidth, height: canvasHeight };
    };

    /**
     * Handle dragging of triangles
     */
    const handleDrag = useCallback((personId, newX, newY) => {
        setPositions(prev => {
            const newPositions = new Map(prev);
            newPositions.set(personId, { x: newX, y: newY });
            
            // Move partners with the person
            const partners = partnersMap.get(personId) || [];
            partners.forEach(partnerId => {
                const partnerPos = prev.get(partnerId);
                if (partnerPos) {
                    const offsetX = newX - prev.get(personId).x;
                    const offsetY = newY - prev.get(personId).y;
                    newPositions.set(partnerId, {
                        x: partnerPos.x + offsetX,
                        y: partnerPos.y + offsetY
                    });
                }
            });
            
            return newPositions;
        });
    }, [partnersMap]);

    /**
     * Handle triangle click
     */
    const handleTriangleClick = (person, clientX, clientY) => {
        setSelectedPerson(person);
        setContextMenu({ x: clientX, y: clientY });
    };

    /**
     * Close context menu
     */
    const handleCloseContextMenu = () => {
        setContextMenu(null);
    };

    /**
     * Handle edit person
     */
    const handleEditPerson = (person) => {
        if (onEditPerson) {
            onEditPerson(person);
        }
    };

    /**
     * Handle delete person
     */
    const handleDeletePerson = (person) => {
        if (onDeletePerson) {
            onDeletePerson(person);
        }
    };

    /**
     * Handle add person
     */
    const handleAddPerson = (person) => {
        if (onAddPerson) {
            onAddPerson(person);
        }
    };

    /**
     * Draw connection lines
     */
    const renderConnectionLines = () => {
        const lines = [];
        
        console.log('=== Rendering Connection Lines ===');
        console.log('Parents relationships:', parentsMap);
        console.log('Partners relationships:', partnersMap);
        console.log('Positions:', positions);
        
        // Parent-child connections
        parentsMap.forEach((parents, childId) => {
            console.log(`Processing child ${childId}:`, parents);
            const childPos = positions.get(childId);
            if (!childPos) {
                console.log(`No position for child ${childId}`);
                return;
            }
            
            const childTopY = childPos.y;
            const childLeftX = childPos.x - TRIANGLE_WIDTH / 2;
            const childRightX = childPos.x + TRIANGLE_WIDTH / 2;
            const childBlueRightTopX = childPos.x - TRIANGLE_WIDTH / 2 + TRIANGLE_WIDTH * 0.1;
            const childPinkLeftTopX = childPos.x + TRIANGLE_WIDTH / 2 - TRIANGLE_WIDTH * 0.1;
            
            // Father connection (to right top corner of the small blue triangle)
            if (parents.fatherId) {
                const fatherPos = positions.get(parents.fatherId);
                console.log(`Father ${parents.fatherId} position:`, fatherPos);
                if (fatherPos) {
                    const fatherBottomX = fatherPos.x;
                    const fatherBottomY = fatherPos.y + TRIANGLE_HEIGHT;
                    console.log(`Drawing father line from (${fatherBottomX},${fatherBottomY}) to (${childBlueRightTopX},${childTopY})`);
                    lines.push(
                        <line
                            key={`father-${parents.fatherId}-${childId}`}
                            x1={fatherBottomX}
                            y1={fatherBottomY}
                            x2={childBlueRightTopX}
                            y2={childTopY}
                            stroke="#2196F3"
                            strokeWidth="2"
                            strokeDasharray="5,5"
                        />
                    );
                }
            }
            
            // Mother connection (to left top corner of the small pink triangle)
            if (parents.motherId) {
                const motherPos = positions.get(parents.motherId);
                console.log(`Mother ${parents.motherId} position:`, motherPos);
                if (motherPos) {
                    const motherBottomX = motherPos.x;
                    const motherBottomY = motherPos.y + TRIANGLE_HEIGHT;
                    console.log(`Drawing mother line from (${motherBottomX},${motherBottomY}) to (${childPinkLeftTopX},${childTopY})`);
                    lines.push(
                        <line
                            key={`mother-${parents.motherId}-${childId}`}
                            x1={motherBottomX}
                            y1={motherBottomY}
                            x2={childPinkLeftTopX}
                            y2={childTopY}
                            stroke="#E91E63"
                            strokeWidth="2"
                            strokeDasharray="5,5"
                        />
                    );
                }
            }
        });
        
        // Partner connections (bottom points connected)
        partnersMap.forEach((partners, personId) => {
            const person1Pos = positions.get(personId);
            if (!person1Pos) return;
            
            partners.forEach(partnerId => {
                const person2Pos = positions.get(partnerId);
                if (!person2Pos) return;
                
                // Only draw once per pair
                if (personId < partnerId) {
                    const person1BottomX = person1Pos.x;
                    const person1BottomY = person1Pos.y + TRIANGLE_HEIGHT;
                    const person2BottomX = person2Pos.x;
                    const person2BottomY = person2Pos.y + TRIANGLE_HEIGHT;
                    
                    console.log(`Drawing partner line between ${personId} and ${partnerId}`);
                    lines.push(
                        <line
                            key={`partner-${personId}-${partnerId}`}
                            x1={person1BottomX}
                            y1={person1BottomY}
                            x2={person2BottomX}
                            y2={person2BottomY}
                            stroke="#808080"
                            strokeWidth="2"
                        />
                    );
                }
            });
        });
        
        console.log(`Total lines to render: ${lines.length}`);
        console.log('=== End Connection Lines ===');
        return lines;
    };

    // Build tree when rootPerson or generations change
    useEffect(() => {
        buildFamilyTree();
    }, [buildFamilyTree]);

    if (!rootPerson) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                Selecteer een persoon in de rechterdrawer om de stamboom te tonen
            </div>
        );
    }

    console.log('Rendering family tree:', {
        personsCount: familyData.size,
        positionsCount: positions.size,
        parentsCount: parentsMap.size,
        partnersCount: partnersMap.size
    });
    
    console.log('Relationships state:', {
        parents: Array.from(parentsMap.entries()),
        partners: Array.from(partnersMap.entries())
    });

    return (
        <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>
            <svg 
                style={{ 
                    width: `${canvasSize.width}px`, 
                    height: `${canvasSize.height}px`,
                    minWidth: '100%',
                    minHeight: '100%'
                }}
            >
                {/* Connection lines (drawn first, so they appear behind triangles) */}
                {renderConnectionLines()}
                
                {/* Person triangles */}
                {Array.from(familyData.entries()).map(([personId, person]) => {
                    const pos = positions.get(personId);
                    if (!pos) return null;
                    
                    return (
                        <PersonTriangle
                            key={personId}
                            person={person}
                            x={pos.x}
                            y={pos.y}
                            width={TRIANGLE_WIDTH}
                            height={TRIANGLE_HEIGHT}
                            onDragStart={setDraggingPersonId}
                            onDrag={handleDrag}
                            onDragEnd={() => setDraggingPersonId(null)}
                            onClick={handleTriangleClick}
                            partners={partnersMap.get(personId) || []}
                            isPartnerDragging={
                                draggingPersonId && 
                                partnersMap.get(draggingPersonId)?.includes(personId)
                            }
                            isSelected={selectedPerson && selectedPerson.PersonID === personId}
                            isRootPerson={personId === rootPerson?.PersonID}
                        />
                    );
                })}
            </svg>
            
            {/* Context menu */}
            <PersonContextMenu
                anchorPosition={contextMenu}
                onClose={handleCloseContextMenu}
                onEditPerson={handleEditPerson}
                onDeletePerson={handleDeletePerson}
                onAddPerson={handleAddPerson}
                person={selectedPerson}
            />
        </div>
    );
};

FamilyTreeCanvas.propTypes = {
    rootPerson: PropTypes.shape({
        PersonID: PropTypes.number.isRequired,
        PersonGivvenName: PropTypes.string,
        PersonFamilyName: PropTypes.string,
        PersonDateOfBirth: PropTypes.string,
    }),
    nbrOfParentGenerations: PropTypes.number,
    nbrOfChildGenerations: PropTypes.number,
    treeRefreshTrigger: PropTypes.number,
    lastAddedParentId: PropTypes.number,
    onEditPerson: PropTypes.func,
    onDeletePerson: PropTypes.func,
    onAddPerson: PropTypes.func,
};

export default FamilyTreeCanvas;
