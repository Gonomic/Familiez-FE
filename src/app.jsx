import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useNavigate } from 'react-router-dom';
import TopBar from './TopBar';
import LeftDrawer from './LeftDrawer';
import RightDrawer from './RightDrawer';
import Footer from './Footer';

import FamiliezBewerken from './FamiliezBewerken';
import FamiliezInfo from './FamiliezInfo';
import FamiliezSysteem from './FamiliezSysteem';

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
    // Clear edit mode
    setPersonToEdit(null);
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
    // Clear delete mode
    setPersonToDelete(null);
  };


  return (
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

      <Routes>
        <Route 
          path="/familiez-bewerken" 
          element={
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
          } 
        />
        <Route path="/familiez-info" element={<FamiliezInfo />} />
        <Route path="/familiez-systeem" element={<FamiliezSysteem />} />
        <Route path="/" element={<Navigate to="/familiez-bewerken" />} />
      </Routes>

      <Footer />
    </>
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
