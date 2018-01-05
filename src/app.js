import {h, render, Component} from "preact";
import {DBMon} from "./dbmon";

/** "Hello World" component w/ a button click listener. */
class Hello extends Component {
  constructor(props) {
    super(props);
    this.state = {
      clicked: false,
    };

    this.handleClick = this.handleClick.bind(this);
  }

  handleClick(event) {
    this.setState({
      clicked: true,
    });
  }

  render(props, state) {
    return (
      <div>
        <p>
          Hello {props.name}! Button was clicked? {state.clicked}
        </p>
        <button onClick={this.handleClick}>Button</button>
      </div>
    );
  }
}

/** To-do list adapted from example on https://reactjs.org. */
const TodoList = props => (
  <ul>{props.items.map(item => <li key={item.id}>{item.text}</li>)}</ul>
);
class TodoApp extends Component {
  constructor(props) {
    super(props);

    this.state = {
      items: [],
      text: "<Add TODO>",
      id: 0,
      focused: false,
    };

    this.handleChange = this.handleChange.bind(this);
    this.handleFocus = this.handleFocus.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  render(props, state) {
    return (
      <div>
        <h3>TODO</h3>
        <TodoList items={state.items} />
        <input
          onChange={this.handleChange}
          onFocus={this.handleFocus}
          value={state.text}
        />
        <button onClick={this.handleSubmit}>
          Add #{state.items.length + 1}
        </button>
      </div>
    );
  }

  handleChange(e) {
    this.setState({
      text: e.target.value,
    });
  }

  handleFocus(e) {
    // Clear placeholder text on first focus.
    if (!this.state.focused) {
      this.setState({
        text: "",
        focused: true,
      });
    }
  }

  handleSubmit(e) {
    const {text, id} = this.state;

    if (!text.length) {
      return;
    }
    this.setState(prevState => ({
      items: prevState.items.concat({
        text,
        id,
      }),
      text: "",
      id: prevState.id + 1,
    }));
  }
}

/** Timer example from https://reactjs.org */
class Timer extends Component {
  constructor(props) {
    super(props);
    this.state = {
      seconds: 0,
    };

    this.tick = this.tick.bind(this);
  }

  tick() {
    this.setState(prevState => ({
      seconds: prevState.seconds + 1,
    }));
  }

  componentDidMount() {
    this.interval = setInterval(this.tick, 1000);
  }

  componentWillUnmount() {
    clearInterval(this.interval);
  }

  render(_, state) {
    return <div>Seconds: {state.seconds}</div>;
  }
}

// TODO(willchou): Support rendering to nodes other than body.
// render(<Hello />, document.body);
render(<TodoApp />, document.body);
// render(<Timer />, document.body);
// render(<DBMon />, document.body);
