import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useNavigate } from 'react-router-dom';
import TopBar from './TopBar';
import LeftDrawer from './LeftDrawer';
import RightDrawer from './RightDrawer';
import Footer from './Footer';

import FamiliezBewerken from './FamiliezBewerken';
import FamiliezInfo from './FamiliezInfo';
import FamiliezSysteem from './FamiliezSysteem';
import LoginPage from './pages/LoginPage';
import AuthCallback from './pages/AuthCallback';
import { getStoredToken, initiateSSOLogin } from './services/authService';

const RequireAuth = ({ children }) => {
  const [hasToken, setHasToken] = useState(Boolean(getStoredToken()));
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const updateAuth = () => setHasToken(Boolean(getStoredToken()));
    updateAuth();
    window.addEventListener('familiez-auth-updated', updateAuth);
    window.addEventListener('storage', updateAuth);
    return () => {
      window.removeEventListener('familiez-auth-updated', updateAuth);
      window.removeEventListener('storage', updateAuth);
    };
  }, []);

  // If no token, redirect to login page
  useEffect(() => {
    if (!hasToken) {
      navigate('/');
    }
  }, [hasToken, navigate]);

  if (error) {
    return <div>{error}</div>;
  }

  if (!hasToken) {
    return <div>Redirecting to login...</div>;
  }

  return children;
};

const AppContent = () => {
  const navigate = useNavigate();
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [personToEdit, setPersonToEdit] = useState(null);
  const [personToDelete, setPersonToDelete] = useState(null);
  const [personToAdd, setPersonToAdd] = useState(undefined);
  const [nbrOfParentGenerations, setNbrOfParentGenerations] = useState(1);
  const [nbrOfChildGenerations, setNbrOfChildGenerations] = useState(1);
  const [treeRefreshTrigger, setTreeRefreshTrigger] = useState(0);
  const [lastAddedParentId, setLastAddedParentId] = useState(null);

  const toggleLeftDrawer = () => {
    setLeftDrawerOpen(!leftDrawerOpen);
  };

  const toggleRightDrawer = () => {
    setRightDrawerOpen(!rightDrawerOpen);
  };

  const handleLeftDrawerClose = () => {
    setLeftDrawerOpen(false);
  };

  const handleRightDrawerClose = () => {
    setRightDrawerOpen(false);
    // Clear edit/delete/add modes when drawer closes
    setPersonToEdit(null);
    setPersonToDelete(null);
    setPersonToAdd(null);
  };

  const handlePersonSelected = (person, parentGens, childGens) => {
    setSelectedPerson(person);
    setNbrOfParentGenerations(parentGens);
    setNbrOfChildGenerations(childGens);
  };

  const handleEditPerson = (person) => {
    setPersonToEdit(person);
    setRightDrawerOpen(true);
  };

  const handleDeletePerson = (person) => {
    setPersonToDelete(person);
    setRightDrawerOpen(true);
  };

  const handleAddPerson = (person) => {
    setPersonToAdd(person);
    setRightDrawerOpen(true);
  };

  const handlePersonUpdated = (updatedPerson) => {
    if (updatedPerson) {
      // Update the selected person if it was edited
      if (selectedPerson && selectedPerson.PersonID === updatedPerson.PersonID) {
        setSelectedPerson(updatedPerson);
      }
      // Trigger tree refresh
      setTreeRefreshTrigger(prev => prev + 1);
    }
    // Clear edit mode and close drawer
    setPersonToEdit(null);
    setPersonToAdd(null);
    setPersonToDelete(null);
    setRightDrawerOpen(false);
  };

  const handlePersonAdded = (newPerson) => {
    // Trigger tree refresh after adding a person
    if (newPerson) {
      // If no person was selected, set the new person as selected
      if (!selectedPerson) {
        setSelectedPerson(newPerson);
        setNbrOfParentGenerations(1);
        setNbrOfChildGenerations(1);
        // Navigate to the tree view to show the new person
        navigate('/familiez-bewerken');
      }
      setTreeRefreshTrigger(prev => prev + 1);
      if (personToAdd?.PersonID) {
        setLastAddedParentId(personToAdd.PersonID);
      }
    }
    // Clear add mode and close drawer
    setPersonToAdd(null);
    setRightDrawerOpen(false);
  };

  const handlePersonDeleted = () => {
    // Trigger tree refresh after deletion
    setTreeRefreshTrigger(prev => prev + 1);
    // Clear delete mode and close drawer
    setPersonToDelete(null);
    setPersonToEdit(null);
    setPersonToAdd(null);
    setRightDrawerOpen(false);
  };

  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route 
        path="/familiez-bewerken" 
        element={
          <RequireAuth>
            <>
              <TopBar toggleLeftDrawer={toggleLeftDrawer} toggleRightDrawer={toggleRightDrawer} />
              <LeftDrawer open={leftDrawerOpen} onClose={handleLeftDrawerClose} />
              <RightDrawer 
                open={rightDrawerOpen} 
                onClose={handleRightDrawerClose} 
                onPersonSelected={handlePersonSelected}
                personToEdit={personToEdit}
                personToDelete={personToDelete}
                personToAdd={personToAdd}
                onPersonUpdated={handlePersonUpdated}
                onPersonAdded={handlePersonAdded}
                onPersonDeleted={handlePersonDeleted}
                onAddPersonClick={handleAddPerson}
              />
              <FamiliezBewerken 
                selectedPerson={selectedPerson}
                nbrOfParentGenerations={nbrOfParentGenerations}
                nbrOfChildGenerations={nbrOfChildGenerations}
                treeRefreshTrigger={treeRefreshTrigger}
                lastAddedParentId={lastAddedParentId}
                onEditPerson={handleEditPerson}
                onDeletePerson={handleDeletePerson}
                onAddPerson={handleAddPerson}
              />
              <Footer />
            </>
          </RequireAuth>
        } 
      />
      <Route path="/familiez-info" element={
        <RequireAuth>
          <>
            <TopBar toggleLeftDrawer={toggleLeftDrawer} toggleRightDrawer={toggleRightDrawer} />
            <LeftDrawer open={leftDrawerOpen} onClose={handleLeftDrawerClose} />
            <RightDrawer 
              open={rightDrawerOpen} 
              onClose={handleRightDrawerClose} 
              onPersonSelected={handlePersonSelected}
            />
            <FamiliezInfo />
            <Footer />
          </>
        </RequireAuth>
      } />
      <Route path="/familiez-systeem" element={
        <RequireAuth>
          <>
            <TopBar toggleLeftDrawer={toggleLeftDrawer} toggleRightDrawer={toggleRightDrawer} />
            <LeftDrawer open={leftDrawerOpen} onClose={handleLeftDrawerClose} />
            <RightDrawer 
              open={rightDrawerOpen} 
              onClose={handleRightDrawerClose} 
              onPersonSelected={handlePersonSelected}
            />
            <FamiliezSysteem />
            <Footer />
          </>
        </RequireAuth>
      } />
    </Routes>
  );
}

const App = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
