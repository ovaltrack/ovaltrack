package com.ovaltrack.backend.division.domain;

import com.ovaltrack.backend.club.domain.Club;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "divisions", indexes = {@Index(name = "idx_divisions_club", columnList = "club_id")})
/* 
@Table(name = "divisions",
uniqueConstraints = {
        @UniqueConstraint(name = "uk_division_nombre", columnNames = { "name", "club_id"}),

})
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class Division {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @EqualsAndHashCode.Include
    private UUID id;

    @Column(nullable = false)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "club_id", nullable = false)
    private Club club;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AgeCategory ageCategory;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Gender gender;

    @Builder.Default
    private Boolean active = true;
}
