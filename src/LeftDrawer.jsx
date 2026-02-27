import { Link, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import CreateIcon from '@mui/icons-material/Create';
import PermDeviceInformationIcon from '@mui/icons-material/PermDeviceInformation';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import LogoutIcon from '@mui/icons-material/Logout';
import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';

import { clearStoredToken, getStoredToken } from './services/authService';

const icons = [<CreateIcon key="create" />, <PermDeviceInformationIcon key="info" />, <SettingsSuggestIcon key="settings" />];

function LeftDrawer({ open, onClose }) {
    const navigate = useNavigate();
    const [isAuthenticated, setIsAuthenticated] = useState(Boolean(getStoredToken()));

    useEffect(() => {
        const updateAuth = () => setIsAuthenticated(Boolean(getStoredToken()));
        updateAuth();
        window.addEventListener('familiez-auth-updated', updateAuth);
        window.addEventListener('storage', updateAuth);
        return () => {
            window.removeEventListener('familiez-auth-updated', updateAuth);
            window.removeEventListener('storage', updateAuth);
        };
    }, []);

    const handleLogout = () => {
        clearStoredToken();
        onClose();
        navigate('/');
    };

    const DrawerList = (
        <Box sx={{ width: 250, display: 'flex', flexDirection: 'column', height: '100%' }} role="presentation" onClick={onClose}>
            <List sx={{ flexGrow: 1 }}>
                {['Familiez bewerken', 'Familiez info', 'Familiez systeem'].map((text, index) => (
                    <ListItem key={text} disablePadding>
                        <ListItemButton component={Link} to={`/${text.toLowerCase().replace(' ', '-')}`}>
                            <ListItemIcon>
                                {icons[index]}
                            </ListItemIcon>
                            <ListItemText primary={text} />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
            {isAuthenticated && (
                <Box sx={{ mt: 'auto' }}>
                    <Divider />
                    <List>
                        <ListItem disablePadding>
                            <ListItemButton onClick={handleLogout}>
                                <ListItemIcon>
                                    <LogoutIcon />
                                </ListItemIcon>
                                <ListItemText primary="Logout" />
                            </ListItemButton>
                        </ListItem>
                    </List>
                </Box>
            )}
        </Box>
    );

    return (
        <div>
            <Drawer open={open} onClose={onClose}>
                {DrawerList}
            </Drawer>
        </div>
    );
}

LeftDrawer.propTypes = {
    onClose: PropTypes.func.isRequired,
    open: PropTypes.bool.isRequired,
};

export default LeftDrawer;

