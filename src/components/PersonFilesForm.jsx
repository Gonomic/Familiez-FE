import { useCallback, useEffect, useMemo, useState } from 'react';
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
    FormControl,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import PropTypes from 'prop-types';
import {
    getFamilyFiles,
    getFather,
    getMother,
    getMwBaseUrl,
    getPersonDetails,
    getPersonFiles,
    uploadDocumentFile,
} from '../services/familyDataService';

const DOCUMENT_TYPES = [
    { value: 'portret', label: 'Portret' },
    { value: 'familiefoto', label: 'Familiefoto' },
    { value: 'trouwakte', label: 'Trouwakte' },
    { value: 'geboorteakte', label: 'Geboorteakte' },
    { value: 'overlijdensakte', label: 'Overlijdensakte' },
    { value: 'opleidingsdocument', label: 'Opleidingsdocument' },
    { value: 'werkdocument', label: 'Werkdocument' },
    { value: 'overig', label: 'Overig' },
];

const PREVIEW_OPTIONS = 'width=900,height=700,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes';

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

const DocumentGrid = ({ title, files, thumbnailBaseUrl, onOpenFile, brokenThumbs, onThumbError, emptyMessage }) => (
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
                    const thumbUrl = `${thumbnailBaseUrl}/api/files/${file.file_id}/thumbnail`;
                    const thumbBroken = brokenThumbs.has(file.file_id);

                    return (
                        <Grid item xs={12} sm={6} key={file.file_id}>
                            <Card variant="outlined">
                                <CardActionArea onClick={() => onOpenFile(file.file_id)}>
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
    thumbnailBaseUrl: PropTypes.string.isRequired,
    onOpenFile: PropTypes.func.isRequired,
    brokenThumbs: PropTypes.instanceOf(Set).isRequired,
    onThumbError: PropTypes.func.isRequired,
    emptyMessage: PropTypes.string.isRequired,
};

const PersonFilesForm = ({ person, onClose }) => {
    const [scope, setScope] = useState('person');
    const [documentType, setDocumentType] = useState(DOCUMENT_TYPES[0].value);
    const [year, setYear] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);

    const [personFiles, setPersonFiles] = useState([]);
    const [familyFiles, setFamilyFiles] = useState([]);
    const [familyContext, setFamilyContext] = useState(null);

    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [brokenThumbs, setBrokenThumbs] = useState(new Set());

    const mwBaseUrl = useMemo(() => getMwBaseUrl(), []);

    const loadFiles = useCallback(async () => {
        if (!person?.PersonID) {
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const currentPersonFiles = await getPersonFiles(person.PersonID);
            setPersonFiles(currentPersonFiles);

            const [fatherId, motherId] = await Promise.all([
                getFather(person.PersonID),
                getMother(person.PersonID),
            ]);

            if (fatherId && motherId) {
                const [father, mother, familyDocs] = await Promise.all([
                    getPersonDetails(fatherId),
                    getPersonDetails(motherId),
                    getFamilyFiles(fatherId, motherId),
                ]);

                setFamilyContext({
                    fatherId,
                    motherId,
                    fatherFirstName: father?.PersonGivvenName || '',
                    fatherLastName: father?.PersonFamilyName || '',
                    motherFirstName: mother?.PersonGivvenName || '',
                    motherLastName: mother?.PersonFamilyName || '',
                });
                setFamilyFiles(familyDocs);
            } else {
                setFamilyContext(null);
                setFamilyFiles([]);
                setScope((prev) => (prev === 'family' ? 'person' : prev));
            }
        } catch (err) {
            console.error('Error loading files:', err);
            setError('Bestanden laden is mislukt.');
        } finally {
            setIsLoading(false);
        }
    }, [person?.PersonID]);

    useEffect(() => {
        loadFiles();
        setSelectedFile(null);
        setYear('');
        setSuccess('');
        setError('');
        setBrokenThumbs(new Set());
    }, [person?.PersonID, loadFiles]);

    const handleUpload = async () => {
        if (!selectedFile || !person?.PersonID) {
            setError('Kies eerst een bestand om te uploaden.');
            return;
        }

        setError('');
        setSuccess('');
        setIsUploading(true);

        try {
            if (scope === 'person') {
                await uploadDocumentFile({
                    file: selectedFile,
                    scope: 'person',
                    entityId: person.PersonID,
                    documentType,
                    year: year.trim() === '' ? null : Number(year),
                    personData: {
                        first_name: person.PersonGivvenName || '',
                        last_name: person.PersonFamilyName || '',
                    },
                });
            } else {
                if (!familyContext?.fatherId || !familyContext?.motherId) {
                    throw new Error('Familie-context niet beschikbaar voor upload.');
                }

                await uploadDocumentFile({
                    file: selectedFile,
                    scope: 'family',
                    entityId: `${familyContext.fatherId}_${familyContext.motherId}`,
                    documentType,
                    year: year.trim() === '' ? null : Number(year),
                    personData: {
                        father_first_name: familyContext.fatherFirstName,
                        father_last_name: familyContext.fatherLastName,
                        mother_first_name: familyContext.motherFirstName,
                        mother_last_name: familyContext.motherLastName,
                    },
                });
            }

            setSelectedFile(null);
            setYear('');
            setSuccess('Bestand succesvol geupload.');
            await loadFiles();
        } catch (err) {
            console.error('Upload failed:', err);
            setError(err.message || 'Upload mislukt.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleOpenFile = (fileId) => {
        window.open(`${mwBaseUrl}/api/files/${fileId}`, 'familiezPreview', PREVIEW_OPTIONS);
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

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, py: 1 }}>
            <Typography variant="h6">
                Bestanden beheren
            </Typography>
            <Typography variant="body2" color="text.secondary">
                {person.PersonGivvenName} {person.PersonFamilyName}
            </Typography>

            {error ? <Alert severity="error">{error}</Alert> : null}
            {success ? <Alert severity="success">{success}</Alert> : null}

            <Divider />

            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Upload
            </Typography>

            <FormControl fullWidth>
                <InputLabel id="scope-select-label">Scope</InputLabel>
                <Select
                    labelId="scope-select-label"
                    label="Scope"
                    value={scope}
                    onChange={(event) => setScope(event.target.value)}
                >
                    <MenuItem value="person">Persoon</MenuItem>
                    <MenuItem value="family" disabled={!familyContext}>
                        Familie
                    </MenuItem>
                </Select>
            </FormControl>

            {!familyContext ? (
                <Typography variant="caption" color="text.secondary">
                    Familie-upload is beschikbaar wanneer deze persoon zowel vader- als moederkoppeling heeft.
                </Typography>
            ) : null}

            <FormControl fullWidth>
                <InputLabel id="document-type-select-label">Document type</InputLabel>
                <Select
                    labelId="document-type-select-label"
                    label="Document type"
                    value={documentType}
                    onChange={(event) => setDocumentType(event.target.value)}
                >
                    {DOCUMENT_TYPES.map((item) => (
                        <MenuItem key={item.value} value={item.value}>
                            {item.label}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            <TextField
                type="number"
                label="Jaar (optioneel)"
                value={year}
                onChange={(event) => setYear(event.target.value)}
                InputProps={{ inputProps: { min: 0, max: 9999 } }}
            />

            <Button variant="outlined" component="label">
                Bestand kiezen
                <input
                    type="file"
                    hidden
                    onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                />
            </Button>

            <Typography variant="caption" color="text.secondary">
                {selectedFile ? selectedFile.name : 'Nog geen bestand gekozen'}
            </Typography>

            <Button
                variant="contained"
                onClick={handleUpload}
                disabled={!selectedFile || isUploading || isLoading}
            >
                {isUploading ? 'Uploaden...' : 'Uploaden'}
            </Button>

            <Divider />

            {isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                    <CircularProgress size={24} />
                </Box>
            ) : (
                <>
                    <DocumentGrid
                        title="Persoonlijke documenten"
                        files={personFiles}
                        thumbnailBaseUrl={mwBaseUrl}
                        onOpenFile={handleOpenFile}
                        brokenThumbs={brokenThumbs}
                        onThumbError={handleThumbError}
                        emptyMessage="Nog geen persoonlijke documenten gevonden."
                    />

                    <DocumentGrid
                        title="Familiedocumenten"
                        files={familyFiles}
                        thumbnailBaseUrl={mwBaseUrl}
                        onOpenFile={handleOpenFile}
                        brokenThumbs={brokenThumbs}
                        onThumbError={handleThumbError}
                        emptyMessage="Nog geen familiedocumenten gevonden."
                    />
                </>
            )}

            <Box sx={{ pt: 1 }}>
                <Button variant="text" onClick={onClose}>
                    Sluiten
                </Button>
            </Box>
        </Box>
    );
};

PersonFilesForm.propTypes = {
    person: PropTypes.shape({
        PersonID: PropTypes.number.isRequired,
        PersonGivvenName: PropTypes.string,
        PersonFamilyName: PropTypes.string,
    }),
    onClose: PropTypes.func.isRequired,
};

export default PersonFilesForm;
