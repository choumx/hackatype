import { h, render, Component } from 'preact';

/** "Hello World" component w/ a button click listener. */
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

/** To-do list adapted from example on https://reactjs.org. */
class TodoApp extends Component {
	constructor(props) {
		super(props);
		
		this.state = { 
			items: [], 
			text: '<Add TODOs here>', 
			id: 0, 
			focused: false,
		};

		this.handleChange = this.handleChange.bind(this);
		this.handleFocus = this.handleFocus.bind(this);
		this.handleSubmit = this.handleSubmit.bind(this);
	}

	render() {
		return (
		<div>
			<h3>TODO</h3>
			<TodoList items={this.state.items} />
			<input
				onChange={this.handleChange}
				onFocus={this.handleFocus}
				value={this.state.text}
			/>
			<button onClick={this.handleSubmit}>
				Add #{this.state.items.length + 1}
			</button>
		</div>
		);
	}

	handleChange(e) {
		this.setState({ text: e.target.value });
	}

	handleFocus(e) {
		// Clear placeholder text on first focus.
		if (!this.state.focused) {
			this.setState({ text: 'focus', focused: true });
		}
	}

	handleSubmit(e) {
		if (!this.state.text.length) {
			return;
		}
		const newItem = {
			text: this.state.text,
			id: this.state.id
		};
		this.setState(prevState => ({
			items: prevState.items.concat(newItem),
			text: '',
			id: prevState.id + 1,
		}));
	}
}

class TodoList extends Component {
	render() {
		return (
		<ul>
			{this.props.items.map(item => (
				<li key={item.id}>{item.text}</li>
			))}
		</ul>
		);
	}
}

// TODO(willchou): Support rendering to nodes other than body.
render(<TodoApp />, document.body);
