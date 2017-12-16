import { h, render, Component } from 'preact';

class Hello extends Component {
	constructor(props) {
		super(props);
		this.state = {clicked: false};
	}

	render() {
		return (
			<div>
				<p>Hello {this.props.name}! Button was clicked? {this.state.clicked}</p>
				<button onClick={() => this.setState({clicked: true})}>Button</button>
			</div>
		);
	}
}

render(<Hello name="William" />, document.body);
