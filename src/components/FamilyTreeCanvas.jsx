import { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import PersonTriangle from './PersonTriangle';
import PersonContextMenu from './PersonContextMenu';
import { getPersonDetails, getFather, getMother, getChildren, getPartners } from '../services/familyDataService';
import { getPersonPortraitUrl } from '../services/familyDataService';
import { NO_CONNECTION_ERROR_TEXT } from '../constants/errorMessages';

const MIN_SCALE = 0.4;
const MAX_SCALE = 2.5;
const SHOW_NON_PARTNER_PARENTS_KEY = 'familiez_show_non_partner_parents';

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
    onAddPerson,
    onViewPerson,
    onManageFiles
}) => {
    const rootPersonId = rootPerson?.PersonID ?? null;
    const [familyData, setFamilyData] = useState(new Map());
    const [positions, setPositions] = useState(new Map());
    const [parentsMap, setParentsMap] = useState(new Map());
    const [partnersMap, setPartnersMap] = useState(new Map());
    const [canvasSize, setCanvasSize] = useState({ width: 2000, height: 2000 });
    const [contextMenu, setContextMenu] = useState(null);
    const [selectedPerson, setSelectedPerson] = useState(null);
    const [draggingPersonId, setDraggingPersonId] = useState(null);
    const [isLoadingTree, setIsLoadingTree] = useState(false);
    const [loadingDots, setLoadingDots] = useState('');
    const [treeLoadError, setTreeLoadError] = useState('');
    const [showNonPartnerParents, setShowNonPartnerParents] = useState(
        () => localStorage.getItem(SHOW_NON_PARTNER_PARENTS_KEY) === 'true'
    );
    const buildRequestIdRef = useRef(0);
    // Cache voor portretfoto's
    // Pan/zoom state
    const [viewport, setViewport] = useState({ scale: 1, translateX: 0, translateY: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = useRef({ x: 0, y: 0 });
    const svgRef = useRef(null);
    const hasAutoCenteredRef = useRef(false);

    // Layout constants
        const TRIANGLE_WIDTH = Math.round(120 * 1.3); // 156
        const TRIANGLE_HEIGHT = Math.round(100 * 1.4); // 140
        const PARTNER_CENTER_DISTANCE = TRIANGLE_WIDTH;
        const COUPLE_WIDTH = TRIANGLE_WIDTH + PARTNER_CENTER_DISTANCE;
        const HORIZONTAL_GAP = TRIANGLE_WIDTH;
        const VERTICAL_GAP = TRIANGLE_HEIGHT * 2;

    useEffect(() => {
        const syncSetting = () => {
            setShowNonPartnerParents(localStorage.getItem(SHOW_NON_PARTNER_PARENTS_KEY) === 'true');
        };

        const handleSettingsEvent = (event) => {
            if (event?.detail && typeof event.detail.showNonPartnerParents === 'boolean') {
                setShowNonPartnerParents(event.detail.showNonPartnerParents);
                return;
            }
            syncSetting();
        };

        window.addEventListener('familiez-system-settings-updated', handleSettingsEvent);
        window.addEventListener('storage', syncSetting);
        return () => {
            window.removeEventListener('familiez-system-settings-updated', handleSettingsEvent);
            window.removeEventListener('storage', syncSetting);
        };
    }, []);

    /**
     * Build the family tree data structure
     */
    const buildFamilyTree = useCallback(async () => {
        const requestId = ++buildRequestIdRef.current;

        if (!rootPersonId) {
            // Clear all state when no root person is selected
            setFamilyData(new Map());
            setPositions(new Map());
            setParentsMap(new Map());
            setPartnersMap(new Map());
            setCanvasSize({ width: 2000, height: 2000 });
            setIsLoadingTree(false);
            setTreeLoadError('');
            return;
        }

        setIsLoadingTree(true);
        setTreeLoadError('');

        // Clear existing state before building new tree
        setFamilyData(new Map());
        setPositions(new Map());
        setParentsMap(new Map());
        setPartnersMap(new Map());

        const newFamilyData = new Map();
        const newPositions = new Map();
        const newParentsMap = new Map();
        const newPartnersMap = new Map();
        const newChildrenMap = new Map();
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
            
            const personData = await getPersonDetails(personId);
            if (!personData) {
                return null;
            }
            
            newFamilyData.set(personId, { ...personData, generation });
            return personData;
        };

        // Start with root person
            const rootPersonData = await addPerson(rootPersonId, 0);
            if (!rootPersonData) {
                throw new Error('Failed to load root person');
            }

        // Always include root partner when present.
        const rootPartners = await getPartners(rootPersonId);
        if (rootPartners && rootPartners.length > 0) {
            const rootPartnerId = rootPartners[0].PersonID;
            if (rootPartnerId) {
                await addPerson(rootPartnerId, 0);

                if (!newPartnersMap.has(rootPersonId)) {
                    newPartnersMap.set(rootPersonId, []);
                }
                if (!newPartnersMap.get(rootPersonId).includes(rootPartnerId)) {
                    newPartnersMap.get(rootPersonId).push(rootPartnerId);
                }

                if (!newPartnersMap.has(rootPartnerId)) {
                    newPartnersMap.set(rootPartnerId, []);
                }
                if (!newPartnersMap.get(rootPartnerId).includes(rootPersonId)) {
                    newPartnersMap.get(rootPartnerId).push(rootPersonId);
                }
            }
        }
        
        // Get siblings of root person
        const rootFatherId = await getFather(rootPersonId);
        const rootMotherId = await getMother(rootPersonId);
        
        if (rootFatherId || rootMotherId) {
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
                .filter(s => s.PersonID !== rootPersonId)
                .sort((a, b) => {
                    const dateA = new Date(a.PersonDateOfBirth || '9999-12-31');
                    const dateB = new Date(b.PersonDateOfBirth || '9999-12-31');
                    return dateA - dateB; // Oldest first
                });
            
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
                    }
                }
            }
            
            // Siblings are added in generation 0 for layout context.
        }
        
        // Build upward (parents)
        const buildUpward = async (personId, currentGen) => {
            if (currentGen >= nbrOfParentGenerations) return;
            
            const fatherId = await getFather(personId);
            const motherId = await getMother(personId);
            
            if (fatherId || motherId) {
                newParentsMap.set(personId, { 
                    fatherId: fatherId || null, 
                    motherId: motherId || null 
                });
                
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
                }
            }
        };

        const mergeUniqueChildren = (left, right) => {
            const merged = new Map();
            (left || []).forEach(child => {
                if (child?.PersonID) {
                    merged.set(child.PersonID, child);
                }
            });
            (right || []).forEach(child => {
                if (child?.PersonID) {
                    merged.set(child.PersonID, child);
                }
            });
            return Array.from(merged.values());
        };

        const getCombinedChildrenForPerson = async (personId) => {
            const baseChildren = await getChildren(personId);
            const currentPartners = newPartnersMap.get(personId) || [];
            const partnerId = currentPartners[0] || null;

            if (!partnerId) {
                return baseChildren || [];
            }

            const partnerChildren = await getChildren(partnerId);
            return mergeUniqueChildren(baseChildren || [], partnerChildren || []);
        };

        // Build downward (children)
        const buildDownward = async (personId, depth) => {
            if (depth >= nbrOfChildGenerations) return;
            
            const childrenData = await getCombinedChildrenForPerson(personId);
            
            if (childrenData && childrenData.length > 0) {
                const childIds = childrenData.map(child => child.PersonID);
                newChildrenMap.set(personId, childIds);
                
                for (const child of childrenData) {
                    const childGeneration = -(depth + 1);
                    await addPerson(child.PersonID, childGeneration);
                    
                    // Get the father and mother of this child to establish proper parent relationships
                    const childFatherId = await getFather(child.PersonID);
                    const childMotherId = await getMother(child.PersonID);
                    
                    // Set parent relationship for this child
                    newParentsMap.set(child.PersonID, {
                        fatherId: childFatherId || null,
                        motherId: childMotherId || null
                    });

                    const childParentsArePartners = Boolean(
                        childFatherId && childMotherId && await arePartners(childFatherId, childMotherId)
                    );

                    const includeFatherNode = Boolean(
                        childFatherId && (
                            showNonPartnerParents ||
                            childParentsArePartners ||
                            childFatherId === personId
                        )
                    );

                    const includeMotherNode = Boolean(
                        childMotherId && (
                            showNonPartnerParents ||
                            childParentsArePartners ||
                            childMotherId === personId
                        )
                    );
                    
                    // If we haven't added the parents yet, add them
                    if (includeFatherNode && !newFamilyData.has(childFatherId)) {
                        await addPerson(childFatherId, -depth);
                    }
                    if (includeMotherNode && !newFamilyData.has(childMotherId)) {
                        await addPerson(childMotherId, -depth);
                    }
                    
                    // Only set partners when DB confirms the relationship
                    if (childParentsArePartners) {
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
                    
                    await buildDownward(child.PersonID, depth + 1);
                }
            }
        };

        const includeChildrenForParent = async (parentId) => {
            const parentData = newFamilyData.get(parentId);
            if (!parentData) return;

            const childrenData = await getCombinedChildrenForPerson(parentId);
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

                const childParentsArePartners = Boolean(
                    childFatherId && childMotherId && await arePartners(childFatherId, childMotherId)
                );

                const includeFatherNode = Boolean(
                    childFatherId && (
                        showNonPartnerParents ||
                        childParentsArePartners ||
                        childFatherId === parentId
                    )
                );

                const includeMotherNode = Boolean(
                    childMotherId && (
                        showNonPartnerParents ||
                        childParentsArePartners ||
                        childMotherId === parentId
                    )
                );

                if (includeFatherNode && !newFamilyData.has(childFatherId)) {
                    await addPerson(childFatherId, childGeneration + 1);
                }
                if (includeMotherNode && !newFamilyData.has(childMotherId)) {
                    await addPerson(childMotherId, childGeneration + 1);
                }

                if (childParentsArePartners) {
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

        try {
            // Build the tree
            await buildUpward(rootPersonId, 0);
            await buildDownward(rootPersonId, 0);

            if (lastAddedParentId && newFamilyData.has(lastAddedParentId)) {
                await includeChildrenForParent(lastAddedParentId);
            }

            // Ensure partner visibility for every loaded person (domain: 0 or 1 partner).
            const existingPersonIds = Array.from(newFamilyData.keys());
            for (const personId of existingPersonIds) {
                const partners = await getPartners(personId);
                if (!partners || partners.length === 0) {
                    continue;
                }

                const partnerId = partners[0].PersonID;
                if (!partnerId) {
                    continue;
                }

                const personGeneration = newFamilyData.get(personId)?.generation ?? 0;
                await addPerson(partnerId, personGeneration);

                if (!newPartnersMap.has(personId)) {
                    newPartnersMap.set(personId, []);
                }
                if (!newPartnersMap.get(personId).includes(partnerId)) {
                    newPartnersMap.get(personId).push(partnerId);
                }

                if (!newPartnersMap.has(partnerId)) {
                    newPartnersMap.set(partnerId, []);
                }
                if (!newPartnersMap.get(partnerId).includes(personId)) {
                    newPartnersMap.get(partnerId).push(personId);
                }
            }

            // Calculate positions and canvas size
            const canvasDimensions = calculatePositions(newFamilyData, newParentsMap, newPartnersMap, rootPersonId, newPositions);

            if (requestId !== buildRequestIdRef.current) {
                return;
            }

            setFamilyData(newFamilyData);
            setParentsMap(newParentsMap);
            setPartnersMap(newPartnersMap);
            setPositions(newPositions);
            setCanvasSize(canvasDimensions);
                // Lazy/progressieve foto-ophaal met caching en concurrency
                const personIds = Array.from(newFamilyData.keys());
                const maxConcurrency = 5;
                let activeFetches = 0;
                let queue = [...personIds];
                const cache = new Map();

                const fetchNext = async () => {
                        if (queue.length === 0) return;
                        if (activeFetches >= maxConcurrency) return;
                        const personId = queue.shift();
                        activeFetches++;
                        (async () => {
                            try {
                                // Haal portretfoto-url op via utility
                                const photoUrl = await getPersonPortraitUrl(personId);
                                if (photoUrl) {
                                    cache.set(personId, photoUrl);
                                    // Voeg photoUrl toe aan familyData
                                    const person = newFamilyData.get(personId);
                                    if (person) {
                                         if (!person.photoUrl) {
                                            // Maak een nieuwe Map aan zodat React altijd een her-render doet
                                                setFamilyData(prev => {
                                                    const updated = new Map(prev);
                                                    updated.set(personId, { ...person, photoUrl });
                                                    return updated;
                                                });
                                         }
                                    }
                                }
                            } catch (err) {
                                // Fout bij foto-ophaal: log, maar boom blijft werken
                                console.warn('Foto-ophaal fout voor persoon', personId, err);
                            } finally {
                                activeFetches--;
                                fetchNext();
                            }
                        })();
                };

                // Start initial fetches
                for (let i = 0; i < maxConcurrency && queue.length > 0; i++) {
                    fetchNext();
                }
        } catch (error) {
            console.error('Error while building family tree:', error);
            if (requestId === buildRequestIdRef.current) {
                setFamilyData(new Map());
                setPositions(new Map());
                setParentsMap(new Map());
                setPartnersMap(new Map());
                setTreeLoadError(NO_CONNECTION_ERROR_TEXT);
            }
        } finally {
            if (requestId === buildRequestIdRef.current) {
                setIsLoadingTree(false);
            }
        }
    // calculatePositions is a stable in-component helper for this callback scope.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rootPersonId, nbrOfParentGenerations, nbrOfChildGenerations, treeRefreshTrigger, lastAddedParentId, showNonPartnerParents]);

    /**
     * Calculate positions for all persons
     */
    const calculatePositions = (familyData, parentsMap, partnersMap, rootPersonId, positions) => {
        // Group persons by generation
        const generations = new Map();
        familyData.forEach((person, personId) => {
            const gen = person.generation;
            if (!generations.has(gen)) {
                generations.set(gen, []);
            }
            generations.get(gen).push(personId);
        });

        if (generations.size === 0) {
            return { width: 2000, height: 2000 };
        }

        // Build parent -> children map from parent references
        const parentToChildren = new Map();
        parentsMap.forEach((parents, childId) => {
            const fatherId = parents?.fatherId;
            const motherId = parents?.motherId;

            if (fatherId) {
                if (!parentToChildren.has(fatherId)) {
                    parentToChildren.set(fatherId, []);
                }
                parentToChildren.get(fatherId).push(childId);
            }

            if (motherId) {
                if (!parentToChildren.has(motherId)) {
                    parentToChildren.set(motherId, []);
                }
                parentToChildren.get(motherId).push(childId);
            }
        });

        const maxGeneration = Math.max(...generations.keys());
        const TOP_MARGIN = 200;
        const centerY = TOP_MARGIN + (maxGeneration * VERTICAL_GAP);

        const generationPartnerCenters = new Map();

        const sortByBirthDate = (aId, bId) => {
            const dateA = new Date(familyData.get(aId)?.PersonDateOfBirth || '9999-12-31');
            const dateB = new Date(familyData.get(bId)?.PersonDateOfBirth || '9999-12-31');
            return dateA - dateB;
        };

        const getParentAnchor = (parentId, parentGen) => {
            const genPartnerMap = generationPartnerCenters.get(parentGen) || new Map();
            if (genPartnerMap.has(parentId)) {
                return genPartnerMap.get(parentId);
            }

            const parentPos = positions.get(parentId);
            return parentPos ? parentPos.x : null;
        };

        // Group bloodline persons under their visible upper parent-pair and sort oldest->youngest.
        // This is used for descendants and generation 0, so sibling order stays stable within a generation.
        const getGroupedAndSortedIds = (personIds, gen) => {
            const groups = new Map();
            const ungrouped = [];
            const parentsInPrevGen = new Set(generations.get(gen + 1) || []);

            const createPairKey = (aId, bId) => {
                const left = Math.min(aId, bId);
                const right = Math.max(aId, bId);
                return `pair-${left}-${right}`;
            };

            const createSingleKey = (parentId) => `single-${parentId}`;

            const ensureGroup = (key, parentIds) => {
                if (!groups.has(key)) {
                    groups.set(key, { childIds: [], parentIds: [...parentIds] });
                }
                return groups.get(key);
            };

            const resolveGroup = (fatherId, motherId) => {
                const fatherInPrev = Boolean(fatherId && parentsInPrevGen.has(fatherId));
                const motherInPrev = Boolean(motherId && parentsInPrevGen.has(motherId));

                // Both parents present in upper generation: group under both, even if no active partnership.
                if (fatherInPrev && motherInPrev) {
                    return {
                        key: createPairKey(fatherId, motherId),
                        parentIds: [fatherId, motherId],
                    };
                }

                const onlyParentId = fatherInPrev ? fatherId : (motherInPrev ? motherId : null);
                if (!onlyParentId) {
                    return null;
                }

                // If the visible parent belongs to an upper pair in this generation,
                // place all their children (also one-parent linked) under that same pair.
                const upperPartners = (partnersMap.get(onlyParentId) || [])
                    .filter(pid => parentsInPrevGen.has(pid));

                if (upperPartners.length > 0) {
                    return {
                        key: createPairKey(onlyParentId, upperPartners[0]),
                        parentIds: [onlyParentId, upperPartners[0]],
                    };
                }

                return {
                    key: createSingleKey(onlyParentId),
                    parentIds: [onlyParentId],
                };
            };

            personIds.forEach(personId => {
                const parents = parentsMap.get(personId);
                const fatherId = parents?.fatherId || null;
                const motherId = parents?.motherId || null;
                const groupInfo = resolveGroup(fatherId, motherId);

                if (!groupInfo) {
                    ungrouped.push(personId);
                    return;
                }

                ensureGroup(groupInfo.key, groupInfo.parentIds).childIds.push(personId);
            });

            groups.forEach(group => {
                group.childIds.sort((a, b) => sortByBirthDate(a, b));

                const anchors = group.parentIds
                    .map(parentId => getParentAnchor(parentId, gen + 1))
                    .filter(anchor => anchor !== null);

                if (anchors.length > 0) {
                    group.anchor = anchors.reduce((sum, x) => sum + x, 0) / anchors.length;
                } else {
                    group.anchor = null;
                }
            });

            const sortedGroups = Array.from(groups.values()).sort((a, b) => {
                if (a.anchor !== null && b.anchor !== null) {
                    if (a.anchor !== b.anchor) {
                        return a.anchor - b.anchor;
                    }
                } else if (a.anchor !== null) {
                    return -1;
                } else if (b.anchor !== null) {
                    return 1;
                }

                const aFirst = a.childIds[0];
                const bFirst = b.childIds[0];
                const byBirth = sortByBirthDate(aFirst, bFirst);
                if (byBirth !== 0) {
                    return byBirth;
                }
                return aFirst - bFirst;
            });

            const result = [];
            sortedGroups.forEach(group => result.push(...group.childIds));
            ungrouped.sort((a, b) => sortByBirthDate(a, b));
            result.push(...ungrouped);
            return result;
        };

        const createBlocks = (personIds, gen, presorted = false) => {
            const blocks = [];
            const used = new Set();
            const sortedIds = presorted ? [...personIds] : [...personIds].sort(sortByBirthDate);
            const idSet = new Set(sortedIds);

            const isBloodlineMember = (personId) => {
                const parents = parentsMap.get(personId);
                if (!parents) {
                    return false;
                }
                const fatherInUpperGen = Boolean(parents.fatherId && (generations.get(gen + 1) || []).includes(parents.fatherId));
                const motherInUpperGen = Boolean(parents.motherId && (generations.get(gen + 1) || []).includes(parents.motherId));
                return fatherInUpperGen || motherInUpperGen;
            };

            const orderedCouple = (personId, partnerId) => {
                const personIsBloodline = isBloodlineMember(personId);
                const partnerIsBloodline = isBloodlineMember(partnerId);

                // Rule: bloodline member left, partner right.
                if (personIsBloodline && !partnerIsBloodline) {
                    return [personId, partnerId];
                }
                if (!personIsBloodline && partnerIsBloodline) {
                    return [partnerId, personId];
                }

                const person = familyData.get(personId);
                const partner = familyData.get(partnerId);
                if (person?.PersonIsMale && !partner?.PersonIsMale) {
                    return [personId, partnerId];
                }
                if (!person?.PersonIsMale && partner?.PersonIsMale) {
                    return [partnerId, personId];
                }
                return personId <= partnerId ? [personId, partnerId] : [partnerId, personId];
            };

            sortedIds.forEach(personId => {
                if (used.has(personId)) {
                    return;
                }

                const partners = partnersMap.get(personId) || [];
                const partnerInGen = partners.find(pid => idSet.has(pid) && !used.has(pid));

                if (partnerInGen) {
                    const [leftId, rightId] = orderedCouple(personId, partnerInGen);
                    blocks.push({
                        type: 'couple',
                        members: [leftId, rightId],
                        primaryMember: personId,
                        width: COUPLE_WIDTH,
                    });
                    used.add(personId);
                    used.add(partnerInGen);
                } else {
                    blocks.push({
                        type: 'single',
                        members: [personId],
                        primaryMember: personId,
                        width: TRIANGLE_WIDTH,
                    });
                    used.add(personId);
                }
            });

            return blocks;
        };

        const getChildAnchor = (childId, childGen) => {
            const genPartnerMap = generationPartnerCenters.get(childGen) || new Map();
            if (genPartnerMap.has(childId)) {
                return genPartnerMap.get(childId);
            }

            const childPos = positions.get(childId);
            return childPos ? childPos.x : null;
        };

        // Layout order: root first, then descendants, then ancestors.
        // This keeps parent anchors available when placing descendants and reduces line crossings.
        const rootGenerations = Array.from(generations.keys())
            .filter(gen => gen === 0);
        const descendantGenerations = Array.from(generations.keys())
            .filter(gen => gen < 0)
            .sort((a, b) => b - a);
        const ancestorGenerations = Array.from(generations.keys())
            .filter(gen => gen >= 0)
            .sort((a, b) => a - b);
        const nonRootAncestors = ancestorGenerations.filter(gen => gen !== 0);
        const layoutGenerations = [...rootGenerations, ...descendantGenerations, ...nonRootAncestors];

        layoutGenerations.forEach((gen) => {
            const y = centerY - (gen * VERTICAL_GAP);
            const rawPersonIds = generations.get(gen) || [];
            // Keep strict bloodline age ordering for descendants and generation 0.
            // Ancestor generations still use child-anchor placement to stay visually connected.
            const preserveBloodlineOrder = gen <= 0;
            const personIds = preserveBloodlineOrder ? getGroupedAndSortedIds(rawPersonIds, gen) : rawPersonIds;
            const blocks = createBlocks(personIds, gen, preserveBloodlineOrder);
            const partnerCenterMap = new Map();

            // Determine preferred center for each block.
            
            // For descendants without parent anchors, we need to center them symmetrically around x=0.
            // First pass: determine which blocks have parent anchors.
            const blockAnchorInfo = blocks.map((block, index) => {
                if (preserveBloodlineOrder && gen < 0) {
                    // Descendants: try to find parent anchors
                    const parentAnchors = [];
                    const seenParents = new Set();

                    const anchorOwnerId = block.primaryMember || block.members[0];
                    const parents = parentsMap.get(anchorOwnerId);
                    const parentIds = [parents?.fatherId, parents?.motherId].filter(Boolean);

                    parentIds.forEach(parentId => {
                        if (seenParents.has(parentId)) {
                            return;
                        }
                        const anchor = getParentAnchor(parentId, gen + 1);
                        if (anchor !== null) {
                            parentAnchors.push(anchor);
                            seenParents.add(parentId);
                        }
                    });

                    return {
                        block,
                        index,
                        hasAnchor: parentAnchors.length > 0,
                        anchor: parentAnchors.length > 0 ? parentAnchors.reduce((sum, x) => sum + x, 0) / parentAnchors.length : null
                    };
                }
                return { block, index, hasAnchor: false, anchor: null };
            });

            // For descendants without anchors, calculate centered positioning
            if (preserveBloodlineOrder && gen < 0) {
                const noAnchorBlocks = blockAnchorInfo.filter(info => !info.hasAnchor);
                
                if (noAnchorBlocks.length > 0) {
                    // Calculate total width of blocks without anchors
                    const totalWidth = noAnchorBlocks.reduce((sum, info) => sum + info.block.width, 0) 
                        + (noAnchorBlocks.length - 1) * HORIZONTAL_GAP;
                    const startX = -totalWidth / 2;

                    // Assign centered preferredCenter values
                    noAnchorBlocks.forEach((info, idx) => {
                        const blockStartX = startX + idx * (TRIANGLE_WIDTH + HORIZONTAL_GAP);
                        info.block.preferredCenter = blockStartX + info.block.width / 2;
                    });
                }

                // Assign anchored positions
                blockAnchorInfo.forEach(info => {
                    if (info.hasAnchor) {
                        info.block.preferredCenter = info.anchor;
                    }
                });
            }

            // Regular preferred center determination for non-descendants or non-preserveBloodlineOrder
            blocks.forEach((block, index) => {
                if (preserveBloodlineOrder) {
                    // Already handled above for descendants
                    if (gen < 0) return;
                    
                    // For generation 0, align to known parent anchors when available
                    const parentAnchors = [];
                    const seenParents = new Set();

                    const anchorOwnerId = block.primaryMember || block.members[0];
                    const parents = parentsMap.get(anchorOwnerId);
                    const parentIds = [parents?.fatherId, parents?.motherId].filter(Boolean);

                    parentIds.forEach(parentId => {
                        if (seenParents.has(parentId)) {
                            return;
                        }
                        const anchor = getParentAnchor(parentId, gen + 1);
                        if (anchor !== null) {
                            parentAnchors.push(anchor);
                            seenParents.add(parentId);
                        }
                    });

                    if (parentAnchors.length > 0) {
                        block.preferredCenter = parentAnchors.reduce((sum, x) => sum + x, 0) / parentAnchors.length;
                    } else {
                        block.preferredCenter = index * (TRIANGLE_WIDTH + HORIZONTAL_GAP);
                    }
                    return;
                }

                const childAnchors = [];
                const seenChildren = new Set();

                block.members.forEach(parentId => {
                    const children = parentToChildren.get(parentId) || [];
                    children.forEach(childId => {
                        if (seenChildren.has(childId)) {
                            return;
                        }
                        const anchor = getChildAnchor(childId, gen - 1);
                        if (anchor !== null) {
                            childAnchors.push(anchor);
                            seenChildren.add(childId);
                        }
                    });
                });

                if (childAnchors.length > 0) {
                    block.preferredCenter = childAnchors.reduce((sum, x) => sum + x, 0) / childAnchors.length;
                } else {
                    block.preferredCenter = index * (TRIANGLE_WIDTH + HORIZONTAL_GAP);
                }
            });

            // When bloodline order is fixed, never re-sort by anchors afterwards.
            if (!preserveBloodlineOrder) {
                blocks.sort((a, b) => a.preferredCenter - b.preferredCenter);
            }

            // Layout blocks in a generation
            // For descendants: place sequentially, then center around the anchor person's x-position.
            // For others: use block preferredCenter with overlap resolution.
            
            if (gen < 0) {
                // DESCENDANTS: Simple sequential placement for gelijkelijke verdeling
                let nextX = 0;
                blocks.forEach((block) => {
                    block.leftEdge = nextX;
                    block.rightEdge = nextX + block.width;
                    block.center = (block.leftEdge + block.rightEdge) / 2;
                    nextX = block.rightEdge + HORIZONTAL_GAP;
                });

                // Center all blocks symmetrically around the anchor person's x-position.
                const totalSpan = blocks[blocks.length - 1].rightEdge;
                const rootCenterX = positions.get(rootPersonId)?.x ?? 0;
                const centerShift = rootCenterX - (totalSpan / 2);
                blocks.forEach((block) => {
                    block.leftEdge += centerShift;
                    block.rightEdge += centerShift;
                    block.center += centerShift;
                });
            } else {
                // NON-DESCENDANTS: Standard overlap resolution based on preferredCenter
                let previousRight = null;
                blocks.forEach((block, index) => {
                    const halfWidth = block.width / 2;
                    let leftEdge = block.preferredCenter - halfWidth;

                    if (index === 0) {
                        if (leftEdge < 0) {
                            leftEdge = 0;
                        }
                    } else {
                        const minLeft = previousRight + HORIZONTAL_GAP;
                        if (leftEdge < minLeft) {
                            leftEdge = minLeft;
                        }
                    }

                    block.leftEdge = leftEdge;
                    block.rightEdge = leftEdge + block.width;
                    block.center = leftEdge + halfWidth;
                    previousRight = block.rightEdge;
                });
            }

            // Assign final node positions
            blocks.forEach(block => {
                if (block.type === 'single') {
                    positions.set(block.members[0], { x: block.center, y });
                } else {
                    const [leftId, rightId] = block.members;
                    const leftCenterX = block.center - PARTNER_CENTER_DISTANCE / 2;
                    const rightCenterX = block.center + PARTNER_CENTER_DISTANCE / 2;

                    positions.set(leftId, { x: leftCenterX, y });
                    positions.set(rightId, { x: rightCenterX, y });

                    partnerCenterMap.set(leftId, block.center);
                    partnerCenterMap.set(rightId, block.center);
                }
            });

            generationPartnerCenters.set(gen, partnerCenterMap);
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

        // Symmetric horizontal alignment around root person for both ancestor and descendant sides.
        const rootPos = positions.get(rootPersonId);
        if (rootPos) {
            const leftReach = Math.max(0, rootPos.x - minX);
            const rightReach = Math.max(0, maxX - rootPos.x);
            const halfSpan = Math.max(leftReach, rightReach);
            const targetRootX = halfSpan + 200;
            const shiftX = targetRootX - rootPos.x;

            positions.forEach((pos, pid) => {
                positions.set(pid, { x: pos.x + shiftX, y: pos.y });
            });
            maxX += shiftX;
            minX += shiftX;
        }
        
        const CANVAS_PADDING = 200; // Extra padding around the tree
        const centeredRootPos = positions.get(rootPersonId);
        const centeredHalfSpan = centeredRootPos
            ? Math.max(centeredRootPos.x - minX, maxX - centeredRootPos.x)
            : (maxX - minX) / 2;
        const centeredWidth = centeredHalfSpan * 2 + CANVAS_PADDING * 2;
        const canvasWidth = Math.max(2000, centeredWidth);
        const canvasHeight = Math.max(2000, maxY - minY + CANVAS_PADDING * 2);
        
        return { width: canvasWidth, height: canvasHeight };
    };

    /**
     * Handle dragging of triangles (correct voor pan/zoom)
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
     * Handle view person
     */
    const handleViewPerson = (person) => {
        if (onViewPerson) {
            onViewPerson(person);
        }
    };

    const handleManageFiles = (person) => {
        if (onManageFiles) {
            onManageFiles(person);
        }
    };

    /**
     * Draw connection lines
     */
    const renderConnectionLines = () => {
        const partnerLines = [];
        const partnerDots = [];
        const parentChildLines = [];
        const partnerCenters = new Map();

        const getPairKey = (personAId, personBId) => {
            const left = Math.min(personAId, personBId);
            const right = Math.max(personAId, personBId);
            return `${left}-${right}`;
        };

        // Partner connections (bottom points connected) and center dots
        partnersMap.forEach((partners, personId) => {
            const person1Pos = positions.get(personId);
            if (!person1Pos) return;

            partners.forEach(partnerId => {
                if (personId >= partnerId) {
                    return;
                }

                const person2Pos = positions.get(partnerId);
                if (!person2Pos) return;

                const person1BottomX = person1Pos.x;
                const person1BottomY = person1Pos.y + TRIANGLE_HEIGHT;
                const person2BottomX = person2Pos.x;
                const person2BottomY = person2Pos.y + TRIANGLE_HEIGHT;

                const centerX = (person1BottomX + person2BottomX) / 2;
                const centerY = (person1BottomY + person2BottomY) / 2;
                const pairKey = getPairKey(personId, partnerId);

                partnerCenters.set(pairKey, { x: centerX, y: centerY });

                partnerLines.push(
                    <line
                        key={`partner-${pairKey}`}
                        x1={person1BottomX}
                        y1={person1BottomY}
                        x2={person2BottomX}
                        y2={person2BottomY}
                        stroke="#808080"
                        strokeWidth="2"
                    />
                );

                partnerDots.push(
                    <circle
                        key={`partner-dot-${pairKey}`}
                        cx={centerX}
                        cy={centerY}
                        r="5"
                        fill="#5f6368"
                        stroke="#ffffff"
                        strokeWidth="1"
                    />
                );
            });
        });

        // Parent-child connections
        parentsMap.forEach((parents, childId) => {
            const childPos = positions.get(childId);
            if (!childPos) {
                return;
            }

            const childTopY = childPos.y;
            const childTopMiddleX = childPos.x;
            const childBlueRightTopX = childPos.x - TRIANGLE_WIDTH / 2 + TRIANGLE_WIDTH * 0.1;
            const childPinkLeftTopX = childPos.x + TRIANGLE_WIDTH / 2 - TRIANGLE_WIDTH * 0.1;

            const fatherId = parents.fatherId;
            const motherId = parents.motherId;
            const hasFather = Boolean(fatherId && positions.get(fatherId));
            const hasMother = Boolean(motherId && positions.get(motherId));

            // When father and mother are partners, draw one line from partner center to child top middle.
            if (hasFather && hasMother) {
                const pairKey = getPairKey(fatherId, motherId);
                const partnerCenter = partnerCenters.get(pairKey);

                if (partnerCenter) {
                    parentChildLines.push(
                        <line
                            key={`parent-center-${pairKey}-${childId}`}
                            x1={partnerCenter.x}
                            y1={partnerCenter.y}
                            x2={childTopMiddleX}
                            y2={childTopY}
                            stroke="#666666"
                            strokeWidth="2"
                            strokeDasharray="5,5"
                        />
                    );
                    return;
                }
            }

            // Fallback/original rendering when there is not one matching parent pair center.
            if (hasFather) {
                const fatherPos = positions.get(fatherId);
                parentChildLines.push(
                    <line
                        key={`father-${fatherId}-${childId}`}
                        x1={fatherPos.x}
                        y1={fatherPos.y + TRIANGLE_HEIGHT}
                        x2={childBlueRightTopX}
                        y2={childTopY}
                        stroke="#2196F3"
                        strokeWidth="2"
                        strokeDasharray="5,5"
                    />
                );
            }

            if (hasMother) {
                const motherPos = positions.get(motherId);
                parentChildLines.push(
                    <line
                        key={`mother-${motherId}-${childId}`}
                        x1={motherPos.x}
                        y1={motherPos.y + TRIANGLE_HEIGHT}
                        x2={childPinkLeftTopX}
                        y2={childTopY}
                        stroke="#E91E63"
                        strokeWidth="2"
                        strokeDasharray="5,5"
                    />
                );
            }
        });

        return [...partnerLines, ...parentChildLines, ...partnerDots];
    };

    // Build tree when selected person or generation settings change
    useEffect(() => {
        buildFamilyTree();
    }, [buildFamilyTree]);

    useEffect(() => {
        if (!isLoadingTree) {
            setLoadingDots('');
            return;
        }

        const interval = setInterval(() => {
            setLoadingDots(prev => (prev.length >= 3 ? '' : `${prev}.`));
        }, 400);

        return () => clearInterval(interval);
    }, [isLoadingTree]);

    const getSvgPoint = useCallback((clientX, clientY) => {
        if (!svgRef.current) {
            return null;
        }

        const point = svgRef.current.createSVGPoint();
        point.x = clientX;
        point.y = clientY;

        return point.matrixTransform(svgRef.current.getScreenCTM().inverse());
    }, []);

    const handleCanvasWheel = useCallback((event) => {
        event.preventDefault();

        const svgPoint = getSvgPoint(event.clientX, event.clientY);
        if (!svgPoint) {
            return;
        }

        setViewport(prev => {
            const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
            const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev.scale * zoomFactor));

            if (nextScale === prev.scale) {
                return prev;
            }

            const worldX = (svgPoint.x - prev.translateX) / prev.scale;
            const worldY = (svgPoint.y - prev.translateY) / prev.scale;

            return {
                scale: nextScale,
                translateX: svgPoint.x - (worldX * nextScale),
                translateY: svgPoint.y - (worldY * nextScale)
            };
        });
    }, [getSvgPoint]);

    const handleCanvasMouseDown = useCallback((event) => {
        if (event.button !== 0 || draggingPersonId) {
            return;
        }

        const svgPoint = getSvgPoint(event.clientX, event.clientY);
        if (!svgPoint) {
            return;
        }

        setContextMenu(null);
        setIsPanning(true);
        panStartRef.current = svgPoint;
    }, [draggingPersonId, getSvgPoint]);

    const handleCanvasMouseMove = useCallback((event) => {
        if (!isPanning) {
            return;
        }

        const svgPoint = getSvgPoint(event.clientX, event.clientY);
        if (!svgPoint) {
            return;
        }

        const deltaX = svgPoint.x - panStartRef.current.x;
        const deltaY = svgPoint.y - panStartRef.current.y;

        setViewport(prev => ({
            ...prev,
            translateX: prev.translateX + deltaX,
            translateY: prev.translateY + deltaY
        }));

        panStartRef.current = svgPoint;
    }, [getSvgPoint, isPanning]);

    const stopPanning = useCallback(() => {
        setIsPanning(false);
    }, []);

    // Reset auto-center flag when root person changes
    useEffect(() => {
        hasAutoCenteredRef.current = false;
    }, [rootPersonId]);

    const centerOnRoot = useCallback(() => {
        const rootPos = positions.get(rootPersonId);
        const svgEl = svgRef.current;
        if (!rootPos || !svgEl) {
            return false;
        }

        const { width: svgWidth, height: svgHeight } = svgEl.getBoundingClientRect();
        if (!svgWidth || !svgHeight) {
            return false;
        }

        setViewport({
            scale: 1,
            translateX: svgWidth / 2 - rootPos.x - TRIANGLE_WIDTH / 2,
            translateY: svgHeight / 2 - rootPos.y - TRIANGLE_HEIGHT / 2
        });

        return true;
    }, [positions, rootPersonId, TRIANGLE_WIDTH, TRIANGLE_HEIGHT]);

    // Auto-center on root person when tree first loads
    useEffect(() => {
        if (hasAutoCenteredRef.current || positions.size === 0 || !rootPersonId) {
            return undefined;
        }

        // In VS Code embedded browser the svg can report 0x0 briefly during layout.
        // Retry a few animation frames so first render still centers correctly.
        let attemptsLeft = 6;
        let rafId = null;

        const tryCenter = () => {
            if (hasAutoCenteredRef.current) {
                return;
            }

            if (centerOnRoot()) {
                hasAutoCenteredRef.current = true;
                return;
            }

            attemptsLeft -= 1;
            if (attemptsLeft > 0) {
                rafId = window.requestAnimationFrame(tryCenter);
            }
        };

        tryCenter();

        return () => {
            if (rafId) {
                window.cancelAnimationFrame(rafId);
            }
        };
    }, [positions, rootPersonId, centerOnRoot]);

    // Attach wheel listener as non-passive so preventDefault() works.
    // Include rootPerson in deps so the effect re-runs when the SVG enters the DOM.
    useEffect(() => {
        const svgEl = svgRef.current;
        if (!svgEl) return;
        svgEl.addEventListener('wheel', handleCanvasWheel, { passive: false });
        return () => svgEl.removeEventListener('wheel', handleCanvasWheel);
    }, [handleCanvasWheel, rootPersonId]);

    const resetViewport = useCallback(() => {
        if (!centerOnRoot()) {
            setViewport({ scale: 1, translateX: 0, translateY: 0 });
        }
    }, [centerOnRoot]);

    if (!rootPerson) {
        return (
            <div
                style={{
                    padding: '40px 24px',
                    textAlign: 'center',
                    color: '#213547',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '28px',
                    minHeight: '320px',
                    position: 'relative'
                }}
            >
                <div style={{ fontSize: '18px', fontWeight: 600, position: 'relative', maxWidth: '780px', lineHeight: 1.5 }}>
                    Klik rechtsboven op de drie streepjes om een persoon, familie of stamboom te kiezen.
                    <svg width="96" height="54" style={{ position: 'absolute', left: '100%', top: '-6px' }} viewBox="0 0 96 54" aria-hidden="true">
                        <defs>
                            <marker id="family-tree-arrow-right" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                                <polygon points="0,0 8,4 0,8" fill="#1976d2" />
                            </marker>
                        </defs>
                        <path d="M4 44 C 28 44, 34 10, 90 8" fill="none" stroke="#1976d2" strokeWidth="3" markerEnd="url(#family-tree-arrow-right)" />
                    </svg>
                </div>
                <div style={{ fontSize: '15px', color: '#5f6b7a', position: 'relative', maxWidth: '780px', lineHeight: 1.5 }}>
                    <svg width="96" height="54" style={{ position: 'absolute', right: '100%', top: '-2px' }} viewBox="0 0 96 54" aria-hidden="true">
                        <defs>
                            <marker id="family-tree-arrow-left" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                                <polygon points="0,0 8,4 0,8" fill="#4ca96a" />
                            </marker>
                        </defs>
                        <path d="M92 44 C 68 44, 58 18, 8 12" fill="none" stroke="#4ca96a" strokeWidth="3" markerEnd="url(#family-tree-arrow-left)" />
                    </svg>
                    Gebruik het menu links voor technische informatie, releasegegevens en het testen van de verbinding met de centrale omgeving.
                </div>
            </div>
        );
    }

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '520px', overflow: 'hidden' }}>
            <button
                type="button"
                onClick={resetViewport}
                style={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    zIndex: 3,
                    background: '#1976d2',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px 16px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
                }}
            >
                Reset view
            </button>

            <svg
                ref={svgRef}
                width={canvasSize.width}
                height={canvasSize.height}
                style={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    background: '#f7f7fa',
                    cursor: isPanning ? 'grabbing' : 'grab',
                    userSelect: 'none'
                }}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={stopPanning}
                onMouseLeave={stopPanning}
            >
                <rect x="0" y="0" width={canvasSize.width} height={canvasSize.height} fill="transparent" />
                <g transform={`translate(${viewport.translateX},${viewport.translateY}) scale(${viewport.scale})`}>
                    {renderConnectionLines()}
                    {Array.from(familyData.entries()).map(([personId, person]) => {
                        const pos = positions.get(personId);
                        if (!pos) {
                            return null;
                        }

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
                                isPartnerDragging={Boolean(draggingPersonId && partnersMap.get(draggingPersonId)?.includes(personId))}
                                isSelected={Boolean(selectedPerson && selectedPerson.PersonID === personId)}
                                isRootPerson={personId === rootPersonId}
                            />
                        );
                    })}
                </g>
            </svg>

            {isLoadingTree && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(235, 238, 242, 0.72)',
                        backdropFilter: 'blur(1px)',
                        zIndex: 20,
                        pointerEvents: 'all'
                    }}
                >
                    <div
                        style={{
                            minWidth: '300px',
                            padding: '20px 24px',
                            borderRadius: '14px',
                            background: 'rgba(255, 255, 255, 0.92)',
                            boxShadow: '0 10px 30px rgba(23, 43, 77, 0.14)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '10px',
                            color: '#213547'
                        }}
                    >
                        <svg width="120" height="72" viewBox="0 0 120 72" role="img" aria-label="Stamboom wordt opgebouwd">
                            <line x1="60" y1="58" x2="60" y2="36" stroke="#2f7bbf" strokeWidth="2.5" strokeLinecap="round">
                                <animate attributeName="stroke-dasharray" values="0,40;40,0;0,40" dur="1.4s" repeatCount="indefinite" />
                            </line>
                            <line x1="60" y1="40" x2="36" y2="18" stroke="#4ca96a" strokeWidth="2.5" strokeLinecap="round">
                                <animate attributeName="stroke-dasharray" values="0,40;40,0;0,40" dur="1.4s" begin="0.15s" repeatCount="indefinite" />
                            </line>
                            <line x1="60" y1="40" x2="84" y2="18" stroke="#4ca96a" strokeWidth="2.5" strokeLinecap="round">
                                <animate attributeName="stroke-dasharray" values="0,40;40,0;0,40" dur="1.4s" begin="0.3s" repeatCount="indefinite" />
                            </line>
                            <circle cx="60" cy="58" r="7" fill="#2f7bbf">
                                <animate attributeName="r" values="6;7.5;6" dur="1.4s" repeatCount="indefinite" />
                            </circle>
                            <circle cx="36" cy="18" r="6" fill="#f28a5d">
                                <animate attributeName="opacity" values="0.55;1;0.55" dur="1.4s" begin="0.15s" repeatCount="indefinite" />
                            </circle>
                            <circle cx="84" cy="18" r="6" fill="#f28a5d">
                                <animate attributeName="opacity" values="0.55;1;0.55" dur="1.4s" begin="0.3s" repeatCount="indefinite" />
                            </circle>
                        </svg>
                        <div style={{ fontSize: '18px', fontWeight: 700 }}>Stamboom wordt opgebouwd{loadingDots}</div>
                    </div>
                </div>
            )}

            {treeLoadError && !isLoadingTree && (
                <div
                    style={{
                        position: 'absolute',
                        top: 16,
                        left: 16,
                        right: 80,
                        zIndex: 21,
                        background: '#fdecea',
                        border: '1px solid #f5c2c7',
                        color: '#842029',
                        borderRadius: '8px',
                        padding: '12px 14px',
                        fontWeight: 600,
                        boxShadow: '0 2px 10px rgba(0,0,0,0.08)'
                    }}
                >
                    {treeLoadError}
                </div>
            )}

            {contextMenu && selectedPerson && (
                <PersonContextMenu
                    person={selectedPerson}
                    anchorPosition={contextMenu}
                    onClose={handleCloseContextMenu}
                    onEditPerson={handleEditPerson}
                    onDeletePerson={handleDeletePerson}
                    onAddPerson={handleAddPerson}
                    onViewPerson={handleViewPerson}
                    onManageFiles={handleManageFiles}
                />
            )}
        </div>
    );
};

FamilyTreeCanvas.propTypes = {
    rootPerson: PropTypes.shape({
        PersonID: PropTypes.number,
    }),
    nbrOfParentGenerations: PropTypes.number,
    nbrOfChildGenerations: PropTypes.number,
    treeRefreshTrigger: PropTypes.number,
    lastAddedParentId: PropTypes.number,
    onEditPerson: PropTypes.func,
    onDeletePerson: PropTypes.func,
    onAddPerson: PropTypes.func,
    onViewPerson: PropTypes.func,
    onManageFiles: PropTypes.func,
};

export default FamilyTreeCanvas;
