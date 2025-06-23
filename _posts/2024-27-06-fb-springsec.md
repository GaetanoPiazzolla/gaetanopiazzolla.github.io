---
title: Firebase Auth With Spring Security
image: /assets/favicon/android-chrome-512x512.png
layout: post
date:   2024-06-27 10:55:00 +0100
categories:
  - Java
  - Firebase
  - Security
---


In this article, we will configure a Spring Boot application to authenticate using the Firebase authentication token. 
Disclaimer: This article was originally a response to this [medium article](https://medium.com/comsystoreply/authentication-with-firebase-auth-and-spring-security-fcb2c1dc96d)
I used some different configurations (e.g. I'm not using Spring oauth-resource-server library) 
and more updated code (with Spring-Security 6.3.1) Then I realized that the answer was too long and I needed to write a short tutorial about it.
All the (working) code is available in this [git repository](https://github.com/GaetanoPiazzolla/spring-sec-firebase).

## Libraries 
Let's start with the libraries needed: 

{% highlight kotlin %}
dependencies {
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("com.google.firebase:firebase-admin:9.2.0")
}
{% endhighlight %}

As you can see, we don't really need anything special in here. Just the standard spring-starter-web and security,
with a sprinkle Firebase Admin SDK.

## Firebase Config
Configuring Firebase with the following props:

{% highlight yaml %}
firebase:
    url: ${GOOGLE_ADMIN_CONFIG_DATABASE_URL}
    type: ${GOOGLE_ADMIN_CONFIG_TYPE}
    project-id: ${GOOGLE_ADMIN_CONFIG_PROJECT_ID}
    private-key: ${GOOGLE_ADMIN_CONFIG_PRIVATE_KEY}
    private-key-id: ${GOOGLE_ADMIN_CONFIG_PRIVATE_KEY_ID}
    client-email: ${GOOGLE_ADMIN_CONFIG_CLIENT_EMAIL}
    client-id: ${GOOGLE_ADMIN_CONFIG_CLIENT_ID}
    token-uri: ${GOOGLE_ADMIN_CONFIG_TOKEN_URI}
{% endhighlight %}

And the following Property class: (this is mapped 1-1 with the properties automatically)

{% highlight java %}
@Component
@ConfigurationProperties(prefix = "firebase")
@Data
public class FirebaseConfigProperties {
    private String type;
    private String project_id;
    private String private_key;
    private String private_key_id;
    private String client_email;
    private String client_id;
    private String token_uri;
    private String url;
}
{% endhighlight %}

We can correctly initialize the needed @Bean FirebaseAuth that we will need to verify the JWT token:

{% highlight java %}

@Configuration
public class FirebaseConfig {

    private static final Logger log = LoggerFactory.getLogger(FirebaseConfig.class);

    @Autowired private FirebaseConfigProperties firebaseConfigProperties;

    @PostConstruct
    public void initialize() throws IOException {
        try {

            firebaseConfigProperties.setPrivate_key(
                    firebaseConfigProperties.getPrivate_key().replace("\\n", "\n"));

            String json = new Gson().toJson(firebaseConfigProperties);

            GoogleCredentials credentials =
                    GoogleCredentials.fromStream(new ByteArrayInputStream(json.getBytes()));

            FirebaseOptions options =
                    FirebaseOptions.builder()
                            .setCredentials(credentials)
                            .setDatabaseUrl(firebaseConfigProperties.getUrl())
                            .build();

            FirebaseApp.initializeApp(options);

            log.info("Firebase initialized for URL {}", firebaseConfigProperties.getUrl());
        } catch (IOException e) {
            log.error("Firebase config error", e);
            throw e;
        }
    }

    @Bean
    public FirebaseAuth firebaseAuth() {
        return FirebaseAuth.getInstance();
    }

}
{% endhighlight %}

## Spring Security Config

The core of the security Configuration is in the _SecurityConfig_ class:

{% highlight java %}
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    public static final Logger logger = LoggerFactory.getLogger(SecurityConfig.class);

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {

        http.securityMatcher(WebConstants.API_BASE_PATH)
                .cors(AbstractHttpConfigurer::disable)
                .csrf(AbstractHttpConfigurer::disable)
                .addFilterAfter(new FirebaseAuthenticationFilter(), BasicAuthenticationFilter.class)
                .authorizeHttpRequests(
                        authorizeRequests -> authorizeRequests
                                .requestMatchers(
                                WebConstants.API_BASE_PATH).authenticated()
                );

        return http.build();
    }

}
{% endhighlight %}

Here we have disabled the Cors, Csrf, and added the FirebaseAuthenticationFilter in a specific position in the long
Spring Security Filter Chain. The FirebaseAuthenticationFilter will check the token (only for the *WebConstants.API_BASE_PATH* requests) and provide
the Authentication object to the SecurityContext. 

{% highlight java %}
public class FirebaseAuthenticationFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain)
            throws ServletException, IOException {

        String idToken = request.getHeader(WebConstants.AUTHORIZATION_HEADER);

        if (idToken == null || idToken.isEmpty()) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Missing Firebase ID-Token");
            return;
        }

        try {
            FirebaseToken token =
                    FirebaseAuth.getInstance().verifyIdToken(idToken.replace("Bearer ", ""));

            List<GrantedAuthority> authorities = getAuthoritiesFromToken(token);

            SecurityContextHolder.getContext()
                    .setAuthentication(
                            new FirebaseAuthenticationToken(idToken, token, authorities));

            SecurityContextHolder.getContext().getAuthentication().setAuthenticated(true);

        } catch (Exception e) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid Firebase ID-Token");
            return;
        }

        filterChain.doFilter(request, response);
    }
}
{% endhighlight %}

It's a good practice use a custom Authentication Token, instead of using the old *UsernamePasswordAuthenticationToken*.
In this case, we have the *FirebaseAuthenticationToken*:

{% highlight java %}
public class FirebaseAuthenticationToken extends AbstractAuthenticationToken {

    private FirebaseToken firebaseToken;
    private String idToken;

    public FirebaseAuthenticationToken(Collection<? extends GrantedAuthority> authorities) {
        super(authorities);
    }

    public FirebaseAuthenticationToken(
            String idToken, FirebaseToken firebaseToken, List<GrantedAuthority> authorities) {
        super(authorities);
        this.idToken = idToken;
        this.firebaseToken = firebaseToken;
    }

    @Override
    public Object getCredentials() {
        return idToken;
    }

    @Override
    public Object getPrincipal() {
        return firebaseToken.getUid();
    }
}
{% endhighlight %}

In the *getAuthoritiesFromToken()* method we will convert the [Custom Claims](https://firebase.google.com/docs/auth/admin/custom-claims) of the Firebase Authentication Document, 
that are transmitted in the JWT token, into a list of GrantedAuthorities.

{% highlight java %}
private static List<GrantedAuthority> getAuthoritiesFromToken(FirebaseToken token) {
    Object claims = token.getClaims().get("authorities");
    List<String> permissions = (List<String>) claims;
    List<GrantedAuthority> authorities = AuthorityUtils.NO_AUTHORITIES;
    if (permissions != null && !permissions.isEmpty()) {
        authorities = AuthorityUtils.createAuthorityList(permissions);
    }
    return authorities;
}
{% endhighlight %}

## Adding Claims to a User

In order to add the claims to a user, you can use the Firebase Admin SDK. Here is an example:

{% highlight java %}
@PreAuthorize("hasAuthority('ADMIN')")
@PostMapping(path = "/user-claims/{uid}")
public void addAuthority(@PathVariable String uid, @RequestBody String authorityToAdd)
    throws FirebaseAuthException {

        Map<String, Object> currentClaims = firebaseAuth.getUser(uid).getCustomClaims();

        ArrayList<String> rolesOld =
                (ArrayList<String>) currentClaims.getOrDefault("authorities", List.of());
        Set<String> rolesNew = new HashSet<>(rolesOld);
        rolesNew.add(authorityToAdd);

        HashMap<String, Object> newClaims = new HashMap<>(currentClaims);
        newClaims.put("authorities", rolesNew);
        firebaseAuth.setCustomUserClaims(uid, newClaims);
    }
}
{% endhighlight %}

As you can see, the method is protected by the ADMIN authority, which means in practice that 
if the user does not have in the Authentication table the correct "_Claims.authorities_", the request will be rejected 
with a 403 error.

## Conclusion

In this short tutorial, we have seen some updated configurations to play with Firebase Auth and
Spring Security. I want to thank the original author of the article, [Sebastijan Comsysto](https://medium.com/@sebastijan.comsysto) 
who inspired me to write this one.

Have fun!