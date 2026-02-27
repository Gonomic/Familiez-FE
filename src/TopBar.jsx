import { useEffect, useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import ArticleIcon from '@mui/icons-material/Article';

import { clearStoredToken, getStoredToken, initiateSSOLogin } from './services/authService';

function TopBar({ toggleLeftDrawer, toggleRightDrawer }) {
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

    const handleAuthClick = () => {
        console.log("[TopBar] Auth button clicked, authenticated:", isAuthenticated);
        if (isAuthenticated) {
            clearStoredToken();
            return;
        }

        console.log("[TopBar] Starting SSO login...");
        initiateSSOLogin().catch((error) => {
            console.error('[TopBar] SSO login failed:', error);
            alert(`Login failed: ${error.message}`);
        });
    };

    return (
        <AppBar>
            <Toolbar>
                <Box display="flex" justifyContent="start" flexGrow={1}>
                    <IconButton
                        size="large"
                        edge="start"
                        color="inherit"
                        aria-label="menu"
                        sx={{ mr: 2 }}
                        onClick={() => {
                            toggleLeftDrawer();
                        }}>
                        <MenuIcon />
                    </IconButton>
                </Box>
                <Box display="flex" justifyContent="center" flexGrow={1}>
                    <Typography variant="h6" component="div">
                        Familiez
                    </Typography>
                </Box>
                <Box display="flex" justifyContent="end" flexGrow={1}>
                    <Button color="inherit" onClick={handleAuthClick} sx={{ mr: 2 }}>
                        {isAuthenticated ? 'Logout' : 'Login'}
                    </Button>
                    <IconButton
                        size="large"
                        edge="end"
                        color="inherit"
                        aria-label="fill-in"
                        sx={{ mr: 2 }}
                        onClick={() => {
                            toggleRightDrawer();
                        }}>
                        <ArticleIcon />
                    </IconButton>
                </Box>
            </Toolbar>
        </AppBar>
    );
}

export default TopBar;
