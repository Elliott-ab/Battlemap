export const useStorage = (state, setState) => {
  const downloadMap = (fileName) => {
    const dataStr = JSON.stringify(state);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || 'battle_map.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const uploadMap = (file) => {
    if (!file) {
      console.error('No file selected for upload');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const newState = JSON.parse(e.target.result);
        setState(newState);
      } catch (error) {
        console.error('Error parsing uploaded file:', error);
      }
    };
    reader.readAsText(file);
  };

  return { downloadMap, uploadMap };
};