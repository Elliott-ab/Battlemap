export const useModals = (setModalState) => {
  const showEditModal = (elementId) => {
    setModalState(prev => ({ ...prev, editModal: { isOpen: true, elementId } }));
  };

  const showGridModal = () => {
    setModalState(prev => ({ ...prev, gridModal: true }));
  };

  const showSaveModal = () => {
    setModalState(prev => ({ ...prev, saveModal: true }));
  };

  const showOverwriteModal = () => {
    setModalState(prev => ({ ...prev, overwriteModal: true }));
  };

  return { showEditModal, showGridModal, showSaveModal, showOverwriteModal };
};