import { useEffect, useState } from 'react';
import { NO_CONNECTION_ERROR_TEXT } from '../constants/errorMessages';
import {
    Alert,
    Box,
    Button,
    Card,
    CardActionArea,
    CardContent,
    Chip,
    CircularProgress,
    Divider,
    Grid,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import PropTypes from 'prop-types';
import {
    buildFileAccessUrl,
    getFamilyFiles,
    getMarriageHistoryForPerson,
    getActiveMarriageForPerson,
    getFather,
    getFileBlob,
    getMother,
    getPartners,
    getPersonDetails,
    getPersonFiles,
} from '../services/familyDataService';

const PREVIEW_OPTIONS = 'width=900,height=700,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes';

const EXTENSION_TO_MIME = {
    md: 'text/markdown',
    txt: 'text/plain',
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
};

const getMimeFromFilename = (name) => {
    if (!name || !name.includes('.')) return '';
    const ext = name.split('.').pop()?.toLowerCase() || '';
    return EXTENSION_TO_MIME[ext] || '';
};

const formatDateTime = (value) => {
    if (!value) return '';
    try {
        return new Date(value).toLocaleString('nl-NL');
    } catch (err) {
        return value;
    }
};

const formatBytes = (value) => {
    if (!Number.isFinite(value) || value <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = value;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }

    return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const DocumentGrid = ({ title, files, onOpenFile, brokenThumbs, onThumbError, onOpenError, emptyMessage }) => {
    const handleCardClick = (file) => {
        const popup = window.open('', 'familiezPreview', PREVIEW_OPTIONS);
        if (!popup) {
            onOpenError('Popup geblokkeerd door browser - zet popups alstublieft toe voor deze site');
            return;
        }

        onOpenFile(file, popup).catch((err) => {
            console.error('Failed to open file:', err);
            onOpenError(err.message || 'Bestand openen is mislukt.');
        });
    };

    return (
        <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 700 }}>
                {title}
            </Typography>

            {files.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                    {emptyMessage}
                </Typography>
            ) : (
                <Grid container spacing={1.5}>
                    {files.map((file) => {
                        const thumbUrl = buildFileAccessUrl(`/api/files/${file.file_id}/thumbnail`);
                        const thumbBroken = brokenThumbs.has(file.file_id);

                        return (
                            <Grid item xs={12} sm={6} key={file.file_id}>
                                <Card variant="outlined">
                                    <CardActionArea onClick={() => handleCardClick(file)}>
                                        <Box
                                            sx={{
                                                height: 120,
                                                bgcolor: '#f4f4f4',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                overflow: 'hidden',
                                            }}
                                        >
                                            {!thumbBroken ? (
                                                <Box
                                                    component="img"
                                                    src={thumbUrl}
                                                    alt={file.original_filename || file.filename}
                                                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    onError={() => onThumbError(file.file_id)}
                                                />
                                            ) : (
                                                <InsertDriveFileOutlinedIcon color="action" sx={{ fontSize: 40 }} />
                                            )}
                                        </Box>
                                        <CardContent sx={{ pb: 1.5 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                                                {file.original_filename || file.filename}
                                            </Typography>
                                            <Stack direction="row" spacing={0.75} sx={{ mt: 0.75, mb: 0.75 }}>
                                                <Chip size="small" label={file.document_type || 'onbekend'} />
                                                {file.year ? <Chip size="small" variant="outlined" label={String(file.year)} /> : null}
                                            </Stack>
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                {formatBytes(file.file_size)}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                {formatDateTime(file.created_at)}
                                            </Typography>
                                        </CardContent>
                                    </CardActionArea>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            )}
        </Box>
    );
};

DocumentGrid.propTypes = {
    title: PropTypes.string.isRequired,
    files: PropTypes.arrayOf(PropTypes.shape({
        file_id: PropTypes.number.isRequired,
        filename: PropTypes.string,
        original_filename: PropTypes.string,
        document_type: PropTypes.string,
        year: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        file_size: PropTypes.number,
        created_at: PropTypes.string,
    })).isRequired,
    onOpenFile: PropTypes.func.isRequired,
    brokenThumbs: PropTypes.instanceOf(Set).isRequired,
    onThumbError: PropTypes.func.isRequired,
    onOpenError: PropTypes.func.isRequired,
    emptyMessage: PropTypes.string.isRequired,
};

const formatPersonName = (personData) => {
    if (!personData) return 'Onbekend';
    const given = personData.PersonGivvenName || '';
    const family = personData.PersonFamilyName || '';
    const fullName = `${given} ${family}`.trim();
    return fullName || 'Onbekend';
};

const formatGender = (value) => {
    if (value === 1 || value === '1') return 'Man';
    if (value === 0 || value === '0') return 'Vrouw';
    return 'Onbekend';
};

const formatMarriageDate = (value) => {
    if (!value) return '-';
    try {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return String(value);
        }
        return date.toLocaleDateString('nl-NL');
    } catch (err) {
        return String(value);
    }
};

const formatMarriageReason = (value) => {
    if (!value) return 'actief';

    const mapping = {
        scheiding: 'Scheiding',
        overlijden_een_partner: 'Overlijden van een partner',
        overlijden_beide_partners: 'Overlijden van beide partners',
        onbekend: 'Onbekend',
    };

    return mapping[value] || value;
};

/**
 * PersonViewForm Component
 * Read-only view of person details in the right drawer
 * Available to all users (not just admins)
 */
const PersonViewForm = ({ person, onClose }) => {
    const [fatherName, setFatherName] = useState('Onbekend');
    const [motherName, setMotherName] = useState('Onbekend');
    const [partnerName, setPartnerName] = useState('Geen partner');
    const [isLoadingRelations, setIsLoadingRelations] = useState(false);
    const [loadingDots, setLoadingDots] = useState(1);
    const [personFiles, setPersonFiles] = useState([]);
    const [familyFiles, setFamilyFiles] = useState([]);
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);
    const [filesError, setFilesError] = useState('');
    const [brokenThumbs, setBrokenThumbs] = useState(new Set());
    const [relationsError, setRelationsError] = useState('');
    const [activeMarriage, setActiveMarriage] = useState(null);
    const [marriageHistory, setMarriageHistory] = useState([]);
    const [isLoadingMarriages, setIsLoadingMarriages] = useState(false);
    const [marriageError, setMarriageError] = useState('');

    useEffect(() => {
        if (!isLoadingRelations) {
            setLoadingDots(1);
            return undefined;
        }

        const intervalId = setInterval(() => {
            setLoadingDots((prev) => (prev >= 3 ? 1 : prev + 1));
        }, 450);

        return () => clearInterval(intervalId);
    }, [isLoadingRelations]);

    useEffect(() => {
        if (!person?.PersonID) {
            setFatherName('Onbekend');
            setMotherName('Onbekend');
            setPartnerName('Geen partner');
            setIsLoadingRelations(false);
            setRelationsError('');
            return;
        }

        let isCancelled = false;

        const loadRelations = async () => {
            setIsLoadingRelations(true);
            setRelationsError('');

            try {
                const [fatherId, motherId, partners] = await Promise.all([
                    getFather(person.PersonID, { throwOnError: true }),
                    getMother(person.PersonID, { throwOnError: true }),
                    getPartners(person.PersonID, { throwOnError: true }),
                ]);

                const firstPartnerId = Array.isArray(partners) && partners.length > 0
                    ? partners[0].PersonID
                    : null;

                const [fatherData, motherData, partnerData] = await Promise.all([
                    fatherId ? getPersonDetails(fatherId, { throwOnError: true }) : Promise.resolve(null),
                    motherId ? getPersonDetails(motherId, { throwOnError: true }) : Promise.resolve(null),
                    firstPartnerId ? getPersonDetails(firstPartnerId, { throwOnError: true }) : Promise.resolve(null),
                ]);

                if (!isCancelled) {
                    setFatherName(fatherData ? formatPersonName(fatherData) : 'Onbekend');
                    setMotherName(motherData ? formatPersonName(motherData) : 'Onbekend');
                    setPartnerName(partnerData ? formatPersonName(partnerData) : 'Geen partner');
                }
            } catch (error) {
                if (!isCancelled) {
                    setFatherName('Onbekend');
                    setMotherName('Onbekend');
                    setPartnerName('Onbekend');
                    setRelationsError(NO_CONNECTION_ERROR_TEXT);
                }
                console.error('Error loading person relations for view:', error);
            } finally {
                if (!isCancelled) {
                    setIsLoadingRelations(false);
                }
            }
        };

        loadRelations();

        return () => {
            isCancelled = true;
        };
    }, [person]);

    useEffect(() => {
        if (!person?.PersonID) {
            setPersonFiles([]);
            setFamilyFiles([]);
            setFilesError('');
            setIsLoadingFiles(false);
            setBrokenThumbs(new Set());
            return;
        }

        let isCancelled = false;

        const loadFiles = async () => {
            setIsLoadingFiles(true);
            setFilesError('');
            setBrokenThumbs(new Set());

            try {
                const currentPersonFiles = await getPersonFiles(person.PersonID);
                const [fatherId, motherId] = await Promise.all([
                    getFather(person.PersonID),
                    getMother(person.PersonID),
                ]);

                let currentFamilyFiles = [];
                if (fatherId && motherId) {
                    currentFamilyFiles = await getFamilyFiles(fatherId, motherId);
                }

                if (!isCancelled) {
                    setPersonFiles(currentPersonFiles);
                    setFamilyFiles(currentFamilyFiles);
                }
            } catch (err) {
                console.error('Error loading files in view form:', err);
                if (!isCancelled) {
                    setPersonFiles([]);
                    setFamilyFiles([]);
                    setFilesError(NO_CONNECTION_ERROR_TEXT);
                }
            } finally {
                if (!isCancelled) {
                    setIsLoadingFiles(false);
                }
            }
        };

        loadFiles();

        return () => {
            isCancelled = true;
        };
    }, [person?.PersonID]);

    useEffect(() => {
        if (!person?.PersonID) {
            setActiveMarriage(null);
            setMarriageHistory([]);
            setMarriageError('');
            setIsLoadingMarriages(false);
            return;
        }

        let isCancelled = false;

        const loadMarriageInfo = async () => {
            setIsLoadingMarriages(true);
            setMarriageError('');

            try {
                const [active, history] = await Promise.all([
                    getActiveMarriageForPerson(person.PersonID),
                    getMarriageHistoryForPerson(person.PersonID),
                ]);

                if (!isCancelled) {
                    setActiveMarriage(active);
                    setMarriageHistory(Array.isArray(history) ? history : []);
                }
            } catch (err) {
                console.error('Error loading marriage info in view form:', err);
                if (!isCancelled) {
                    setActiveMarriage(null);
                    setMarriageHistory([]);
                    setMarriageError(NO_CONNECTION_ERROR_TEXT);
                }
            } finally {
                if (!isCancelled) {
                    setIsLoadingMarriages(false);
                }
            }
        };

        loadMarriageInfo();

        return () => {
            isCancelled = true;
        };
    }, [person?.PersonID]);

    const handleOpenFile = async (file, popup) => {
        try {
            const blob = await getFileBlob(file.file_id);
            const fallbackMime = getMimeFromFilename(file.original_filename || file.filename);

            let resolvedBlob = blob;
            if (!blob.type || blob.type === 'application/octet-stream') {
                const targetMime = fallbackMime || 'text/plain';
                resolvedBlob = new Blob([blob], { type: targetMime });
            }

            const blobUrl = URL.createObjectURL(resolvedBlob);

            popup.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>${file.original_filename || file.filename}</title>
                    <style>
                        html, body {
                            margin: 0;
                            padding: 0;
                            height: 100%;
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                        }
                        #toolbar {
                            padding: 12px 15px;
                            border-bottom: 1px solid #ddd;
                            background-color: #f5f5f5;
                            display: flex;
                            gap: 10px;
                            align-items: center;
                        }
                        #toolbar button {
                            padding: 6px 16px;
                            background-color: #2196F3;
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 500;
                        }
                        #toolbar button:hover {
                            background-color: #1976D2;
                        }
                        #content {
                            height: calc(100% - 56px);
                            overflow: auto;
                        }
                        #content iframe {
                            border: none;
                            width: 100%;
                            height: 100%;
                        }
                    </style>
                </head>
                <body>
                    <div id="toolbar">
                        <button onclick="window.close()">Sluiten</button>
                        <span style="flex: 1; color: #666; font-size: 13px;">${file.original_filename || file.filename}</span>
                    </div>
                    <div id="content">
                        <iframe src="${blobUrl}"></iframe>
                    </div>
                </body>
                </html>
            `);
            popup.document.close();

            window.setTimeout(() => {
                URL.revokeObjectURL(blobUrl);
            }, 60_000);
        } catch (err) {
            console.error('Open file failed in view form:', err);
            popup.document.write(`<p style="color:red"><strong>Fout:</strong> ${err.message || 'Bestand openen is mislukt.'}</p>`);
            setFilesError(err.message || 'Bestand openen is mislukt.');
        }
    };

    const handleThumbError = (fileId) => {
        setBrokenThumbs((prev) => {
            const next = new Set(prev);
            next.add(fileId);
            return next;
        });
    };

    if (!person) {
        return null;
    }

    const loadingText = `Gegevens worden opgehaald${'.'.repeat(loadingDots)}`;

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                padding: 3,
                width: '100%',
            }}
        >
            <Typography variant="h6" gutterBottom>
                Persoon Inzien
            </Typography>

            {relationsError && <Alert severity="error" sx={{ mb: 1 }}>{relationsError}</Alert>}

            {isLoadingRelations && (
                <Typography variant="body2" color="text.secondary">
                    Relaties laden...
                </Typography>
            )}

            <TextField
                label="Voornaam"
                value={person.PersonGivvenName || ''}
                fullWidth
                disabled
                InputProps={{
                    readOnly: true,
                }}
            />

            <TextField
                label="Achternaam"
                value={person.PersonFamilyName || ''}
                fullWidth
                disabled
                InputProps={{
                    readOnly: true,
                }}
            />

            <TextField
                label="Geboortedatum"
                type="date"
                value={person.PersonDateOfBirth || ''}
                fullWidth
                disabled
                InputLabelProps={{ shrink: true }}
                InputProps={{
                    readOnly: true,
                }}
            />

            <TextField
                label="Geboorteplaats"
                value={person.PersonPlaceOfBirth || ''}
                fullWidth
                disabled
                InputProps={{
                    readOnly: true,
                }}
            />

            <TextField
                label="Overlijdensdatum"
                type="date"
                value={person.PersonDateOfDeath || ''}
                fullWidth
                disabled
                InputLabelProps={{ shrink: true }}
                InputProps={{
                    readOnly: true,
                }}
            />

            <TextField
                label="Plaats van overlijden"
                value={person.PersonPlaceOfDeath || ''}
                fullWidth
                disabled
                InputProps={{
                    readOnly: true,
                }}
            />

            <TextField
                label="Geslacht"
                value={formatGender(person.PersonIsMale)}
                fullWidth
                disabled
                InputProps={{
                    readOnly: true,
                }}
            />

            <TextField
                label="Vader"
                value={isLoadingRelations ? loadingText : fatherName}
                fullWidth
                disabled
                InputProps={{
                    readOnly: true,
                }}
            />

            <TextField
                label="Moeder"
                value={isLoadingRelations ? loadingText : motherName}
                fullWidth
                disabled
                InputProps={{
                    readOnly: true,
                }}
            />

            <TextField
                label="Partner"
                value={isLoadingRelations ? loadingText : partnerName}
                fullWidth
                disabled
                InputProps={{
                    readOnly: true,
                }}
            />

            <Divider sx={{ mt: 1 }} />

            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Huwelijk
            </Typography>

            {marriageError ? <Alert severity="warning">{marriageError}</Alert> : null}

            {isLoadingMarriages ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                    <CircularProgress size={20} />
                </Box>
            ) : (
                <>
                    <TextField
                        label="Actief huwelijk"
                        value={
                            activeMarriage
                                ? `${activeMarriage.PartnerGivvenName || ''} ${activeMarriage.PartnerFamilyName || ''}`.trim() || 'Onbekend'
                                : 'Geen actief huwelijk'
                        }
                        fullWidth
                        disabled
                        InputProps={{
                            readOnly: true,
                        }}
                    />

                    <TextField
                        label="Startdatum actief huwelijk"
                        value={activeMarriage ? formatMarriageDate(activeMarriage.StartDate) : '-'}
                        fullWidth
                        disabled
                        InputProps={{
                            readOnly: true,
                        }}
                    />

                    <TextField
                        label="Duur actief huwelijk (jaren)"
                        value={activeMarriage ? String(activeMarriage.DurationYears ?? '-') : '-'}
                        fullWidth
                        disabled
                        InputProps={{
                            readOnly: true,
                        }}
                    />

                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Historiek ({marriageHistory.length})
                    </Typography>

                    {marriageHistory.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                            Geen huwelijkshistoriek beschikbaar.
                        </Typography>
                    ) : (
                        <Stack spacing={1}>
                            {marriageHistory.slice(0, 5).map((row) => {
                                const partnerLabel = `${row.PartnerGivvenName || ''} ${row.PartnerFamilyName || ''}`.trim() || 'Onbekend';
                                const startLabel = formatMarriageDate(row.StartDate);
                                const endLabel = row.EndDate ? formatMarriageDate(row.EndDate) : '-';
                                const statusLabel = Number(row.IsActive) === 1 ? 'Actief' : 'Beeindigd';

                                return (
                                    <Box
                                        key={`history-${row.MarriageID}`}
                                        sx={{
                                            p: 1,
                                            border: '1px solid #e0e0e0',
                                            borderRadius: 1,
                                            bgcolor: '#fafafa',
                                        }}
                                    >
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            {partnerLabel} ({statusLabel})
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" display="block">
                                            Start: {startLabel} | Einde: {endLabel} | Reden: {formatMarriageReason(row.EndReason)}
                                        </Typography>
                                    </Box>
                                );
                            })}
                        </Stack>
                    )}
                </>
            )}

            <Divider sx={{ mt: 1 }} />

            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Bestanden
            </Typography>

            {filesError ? <Alert severity="error">{filesError}</Alert> : null}

            {isLoadingFiles ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                    <CircularProgress size={24} />
                </Box>
            ) : (
                <>
                    <DocumentGrid
                        title="Persoonlijke documenten"
                        files={personFiles}
                        onOpenFile={handleOpenFile}
                        brokenThumbs={brokenThumbs}
                        onThumbError={handleThumbError}
                        onOpenError={setFilesError}
                        emptyMessage="Nog geen persoonlijke documenten gevonden."
                    />

                    <DocumentGrid
                        title="Familiedocumenten"
                        files={familyFiles}
                        onOpenFile={handleOpenFile}
                        brokenThumbs={brokenThumbs}
                        onThumbError={handleThumbError}
                        onOpenError={setFilesError}
                        emptyMessage="Nog geen familiedocumenten gevonden."
                    />
                </>
            )}

            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    onClick={onClose}
                >
                    Sluiten
                </Button>
            </Box>
        </Box>
    );
};

PersonViewForm.propTypes = {
    person: PropTypes.shape({
        PersonID: PropTypes.number.isRequired,
        PersonGivvenName: PropTypes.string,
        PersonFamilyName: PropTypes.string,
        PersonDateOfBirth: PropTypes.string,
        PersonDateOfDeath: PropTypes.string,
        PersonPlaceOfBirth: PropTypes.string,
        PersonPlaceOfDeath: PropTypes.string,
        PersonIsMale: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    }),
    onClose: PropTypes.func.isRequired,
};

export default PersonViewForm;
