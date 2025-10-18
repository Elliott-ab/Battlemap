import React, { useState } from 'react';
import Toolbar from '../components/Toolbar.jsx';
import CharacterBuilder from '../components/CharacterBuilder.jsx';
import FellowshipModal from '../components/Modals/FellowshipModal.jsx';

export default function CharacterBuilderWizard() {
	const [fellowshipOpen, setFellowshipOpen] = useState(false);
	return (
		<div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
			<Toolbar variant="dashboard" onFellowshipClick={() => setFellowshipOpen(true)} />
			<div className="main-content" style={{ overflow: 'auto' }}>
				<CharacterBuilder />
			</div>
			<FellowshipModal open={fellowshipOpen} onClose={() => setFellowshipOpen(false)} gameId={null} />
		</div>
	);
}
