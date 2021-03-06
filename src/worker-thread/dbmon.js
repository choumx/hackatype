import {h, render, Component} from "preact";

var ENV =
  ENV ||
  (function() {
    var first = true;
    var counter = 0;
    var data;
    var _base;
    (_base = String.prototype).lpad ||
      (_base.lpad = function(padding, toLength) {
        return padding
          .repeat((toLength - this.length) / padding.length)
          .concat(this);
      });

    function formatElapsed(value) {
      var str = parseFloat(value).toFixed(2);
      if (value > 60) {
        minutes = Math.floor(value / 60);
        comps = (value % 60).toFixed(2).split(".");
        seconds = comps[0].lpad("0", 2);
        ms = comps[1];
        str = minutes + ":" + seconds + "." + ms;
      }
      return str;
    }

    function getElapsedClassName(elapsed) {
      var className = "Query elapsed";
      if (elapsed >= 10.0) {
        className += " warn_long";
      } else if (elapsed >= 1.0) {
        className += " warn";
      } else {
        className += " short";
      }
      return className;
    }

    function countClassName(queries) {
      var countClassName = "label";
      if (queries >= 20) {
        countClassName += " label-important";
      } else if (queries >= 10) {
        countClassName += " label-warning";
      } else {
        countClassName += " label-success";
      }
      return countClassName;
    }

    function updateQuery(object) {
      if (!object) {
        object = {};
      }
      var elapsed = Math.random() * 15;
      object.elapsed = elapsed;
      object.formatElapsed = formatElapsed(elapsed);
      object.elapsedClassName = getElapsedClassName(elapsed);
      object.query = "SELECT blah FROM something";
      object.waiting = Math.random() < 0.5;
      if (Math.random() < 0.2) {
        object.query = "<IDLE> in transaction";
      }
      if (Math.random() < 0.1) {
        object.query = "vacuum";
      }
      return object;
    }

    function cleanQuery(value) {
      if (value) {
        value.formatElapsed = "";
        value.elapsedClassName = "";
        value.query = "";
        value.elapsed = null;
        value.waiting = null;
      } else {
        return {
          query: "***",
          formatElapsed: "",
          elapsedClassName: "",
        };
      }
    }

    function generateRow(object, keepIdentity, counter) {
      var nbQueries = Math.floor(Math.random() * 10 + 1);
      if (!object) {
        object = {};
      }
      object.lastMutationId = counter;
      object.nbQueries = nbQueries;
      if (!object.lastSample) {
        object.lastSample = {};
      }
      if (!object.lastSample.topFiveQueries) {
        object.lastSample.topFiveQueries = [];
      }
      if (keepIdentity) {
        // for Angular optimization
        if (!object.lastSample.queries) {
          object.lastSample.queries = [];
          for (var l = 0; l < 12; l++) {
            object.lastSample.queries[l] = cleanQuery();
          }
        }
        for (var j in object.lastSample.queries) {
          var value = object.lastSample.queries[j];
          if (j <= nbQueries) {
            updateQuery(value);
          } else {
            cleanQuery(value);
          }
        }
      } else {
        object.lastSample.queries = [];
        for (var j = 0; j < 12; j++) {
          if (j < nbQueries) {
            var value = updateQuery(cleanQuery());
            object.lastSample.queries.push(value);
          } else {
            object.lastSample.queries.push(cleanQuery());
          }
        }
      }
      for (var i = 0; i < 5; i++) {
        var source = object.lastSample.queries[i];
        object.lastSample.topFiveQueries[i] = source;
      }
      object.lastSample.nbQueries = nbQueries;
      object.lastSample.countClassName = countClassName(nbQueries);
      return object;
    }

    function getData(keepIdentity) {
      var oldData = data;
      if (!keepIdentity) {
        // reset for each tick when !keepIdentity
        data = [];
        for (var i = 1; i <= ENV.rows; i++) {
          data.push({
            dbname: "cluster" + i,
            query: "",
            formatElapsed: "",
            elapsedClassName: "",
          });
          data.push({
            dbname: "cluster" + i + " slave",
            query: "",
            formatElapsed: "",
            elapsedClassName: "",
          });
        }
      }
      if (!data) {
        // first init when keepIdentity
        data = [];
        for (var i = 1; i <= ENV.rows; i++) {
          data.push({dbname: "cluster" + i});
          data.push({dbname: "cluster" + i + " slave"});
        }
        oldData = data;
      }
      for (var i in data) {
        var row = data[i];
        if (!keepIdentity && oldData && oldData[i]) {
          row.lastSample = oldData[i].lastSample;
        }
        if (!row.lastSample || Math.random() < mutationsValue) {
          counter = counter + 1;
          if (!keepIdentity) {
            row.lastSample = null;
          }
          generateRow(row, keepIdentity, counter);
        } else {
          data[i] = oldData[i];
        }
      }
      first = false;
      return {
        toArray: function() {
          return data;
        },
      };
    }

    var mutationsValue = 0.5;

    function mutations(value) {
      console.log(`set new mutations, ${value}`);
      mutationsValue = value;
    }

    return {
      generateData: getData,
      rows: 50,
      timeout: 0,
      mutations,
    };
  })();

class Query extends Component {
  shouldComponentUpdate(nextProps, nextState) {
    if (nextProps.elapsedClassName !== this.props.elapsedClassName) return true;
    if (nextProps.formatElapsed !== this.props.formatElapsed) return true;
    if (nextProps.query !== this.props.query) return true;
    return false;
  }
  render(props) {
    return (
      <td class={`Query ${props.elapsedClassName}`}>
        {props.formatElapsed}
        <div class="popover left">
          <div class="popover-content">{props.query}</div>
          <div class="arrow" />
        </div>
      </td>
    );
  }
}

class Database extends Component {
  shouldComponentUpdate(nextProps, nextState) {
    return nextProps.lastMutationId !== this.props.lastMutationId;
  }

  render({lastSample, dbname}) {
    return (
      <tr key={dbname}>
        <td class="dbname">{dbname}</td>
        <td class="query-count">
          <span class={lastSample.countClassName}>
            {lastSample.nbQueries}
          </span>
        </td>
        {lastSample.topFiveQueries.map((query, index) => (
          <Query
            key={index}
            query={query.query}
            elapsed={query.elapsed}
            formatElapsed={query.formatElapsed}
            elapsedClassName={query.elapsedClassName}
          />
        ))}
      </tr>
    );
  }
}

class Databases extends Component {
  state = {databases: []};

  loadSamples = _ => {
    this.setState({
      databases: ENV.generateData(true).toArray(),
    });
    // Monitoring.renderRate.ping();
    setTimeout(this.loadSamples, ENV.timeout);
  }

  componentDidMount() {
    this.loadSamples();
  }

  render(_, state) {
    return (
      <tbody>
        {state.databases.map(database => (
          <Database
            key={database.dbname}
            lastMutationId={database.lastMutationId}
            dbname={database.dbname}
            samples={database.samples}
            lastSample={database.lastSample}
          />
        ))}
      </tbody>
    );
  }
}

export class DBMon extends Component {
  state = {mutations: 0.5}
  
  handleSliderChange = e => {
    const mutations = e.target.value/100;
    
    ENV.mutations(mutations);
    this.setState({
      mutations
    });
  }

  render(_, state) {
    return (
      <div>
        <div id="mutations">
          <label id="ratioval">mutations: {(state.mutations * 100).toFixed(0)}%</label>
          <input type="range" onchange={this.handleSliderChange}></input>
        </div>
        <table class="table table-striped latest-data">
          <Databases />
        </table>
      </div>
    );
  }
}

// export class DBMon extends Component {
//   state = {databases: []};

//   loadSamples = _ => {
//     this.setState({
//       databases: ENV.generateData(true).toArray(),
//     });
//     // Monitoring.renderRate.ping();
//     setTimeout(this.loadSamples, ENV.timeout);
//   }

//   componentDidMount() {
//     this.loadSamples();
//   }

//   render(_, state) {
//     return (
//       <div>
//         <div style={'display:flex'}>

//         </div>
//         <table class="table table-striped latest-data">
//           <tbody>
//             {state.databases.map(database => (
//               <Database
//                 key={database.dbname}
//                 lastMutationId={database.lastMutationId}
//                 dbname={database.dbname}
//                 samples={database.samples}
//                 lastSample={database.lastSample}
//               />
//             ))}
//           </tbody>
//         </table>
//       </div>
//     );
//   }
// }
