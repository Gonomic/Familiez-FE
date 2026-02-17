import { Box } from '@mui/system';
import PropTypes from 'prop-types';
import FamilyTreeCanvas from './components/FamilyTreeCanvas';

const FamiliezBewerken = ({ 
    selectedPerson, 
    nbrOfParentGenerations, 
    nbrOfChildGenerations,
    treeRefreshTrigger,
    lastAddedParentId,
    onEditPerson,
    onDeletePerson,
    onAddPerson
}) => {
    return (
        <Box sx={{ 
            position: 'absolute', 
            top: '64px', 
            bottom: '72px', 
            height: 'calc(100% - 136px)', 
            width: '100%', 
            overflow: 'auto',
            bgcolor: '#f5f5f5'
        }}>
            <FamilyTreeCanvas
                rootPerson={selectedPerson}
                nbrOfParentGenerations={nbrOfParentGenerations}
                nbrOfChildGenerations={nbrOfChildGenerations}
                treeRefreshTrigger={treeRefreshTrigger}
                lastAddedParentId={lastAddedParentId}
                onEditPerson={onEditPerson}
                onDeletePerson={onDeletePerson}
                onAddPerson={onAddPerson}
            />
        </Box>
    );
};

FamiliezBewerken.propTypes = {
    selectedPerson: PropTypes.object,
    nbrOfParentGenerations: PropTypes.number,
    nbrOfChildGenerations: PropTypes.number,
    treeRefreshTrigger: PropTypes.number,
    lastAddedParentId: PropTypes.number,
    onEditPerson: PropTypes.func,
    onDeletePerson: PropTypes.func,
    onAddPerson: PropTypes.func,
};

export default FamiliezBewerken;