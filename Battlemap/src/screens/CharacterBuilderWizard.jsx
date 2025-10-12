import React from 'react';
import Toolbar from '../components/Toolbar.jsx';
import CharacterBuilder from '../components/CharacterBuilder.jsx';

export default function CharacterBuilderWizard() {
	return (
		<div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
			<Toolbar variant="dashboard" />
			<div className="main-content" style={{ overflow: 'auto' }}>
				<CharacterBuilder />
			</div>
		</div>
	);
}
