import {h, render, Component} from 'preact';
import {DBMon} from './dbmon';

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
      text: '<Add TODO>',
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
    this.setState({text: e.target.value});
  }

  handleFocus(e) {
    // Clear placeholder text on first focus.
    if (!this.state.focused) {
      this.setState({text: '', focused: true});
    }
  }

  handleSubmit(e) {
    if (!this.state.text.length) {
      return;
    }
    const newItem = {
      text: this.state.text,
      id: this.state.id,
    };
    this.setState((prevState) => ({
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
      {this.props.items.map((item) => (
        <li key={item.id}>{item.text}</li>
      ))}
    </ul>
    );
  }
}

/** Timer example from https://reactjs.org */
class Timer extends Component {
  constructor(props) {
    super(props);
    this.state = { seconds: 0 };
  }

  tick() {
    this.setState(prevState => ({
      seconds: prevState.seconds + 1
    }));
  }

  componentDidMount() {
    this.interval = setInterval(() => this.tick(), 1000);
  }

  componentWillUnmount() {
    clearInterval(this.interval);
  }

  render() {
    return (
      <div>
        Seconds: {this.state.seconds}
      </div>
    );
  }
}

// TODO(willchou): Support rendering to nodes other than body.
// render(<Hello />, document.body);
render(<TodoApp />, document.body);
// render(<Timer />, document.body);
// render(<DBMon />, document.body);
