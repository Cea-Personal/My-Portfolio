export function Skills({ skills = [] }: { skills?: readonly string[] }) {
  return (
    <section id="skills" aria-labelledby="skills-title">
      <h2 id="skills-title">Skills</h2>
      {skills.length ? (
        <ul>
          {skills.map((skill) => (
            <li key={skill}>{skill}</li>
          ))}
        </ul>
      ) : (
        <p>Approved skills will appear here.</p>
      )}
    </section>
  );
}
