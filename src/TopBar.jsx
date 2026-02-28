import React, { useState, useEffect } from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import ArticleIcon from '@mui/icons-material/Article';
import { getUserInfo } from './services/authService';

function TopBar({ toggleLeftDrawer, toggleRightDrawer }) {
    const [userInfo, setUserInfo] = useState(null);

    useEffect(() => {
        const updateUserInfo = () => {
            const info = getUserInfo();
            setUserInfo(info);
        };

        updateUserInfo();
        window.addEventListener('familiez-auth-updated', updateUserInfo);

        return () => {
            window.removeEventListener('familiez-auth-updated', updateUserInfo);
        };
    }, []);

    const displayName = userInfo && userInfo.username
        ? `Familiez (${userInfo.username})`
        : 'Familiez';

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
                        {displayName}
                    </Typography>
                </Box>
                <Box display="flex" justifyContent="end" flexGrow={1}>
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
